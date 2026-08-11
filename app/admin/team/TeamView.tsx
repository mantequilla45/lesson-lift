"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { fmtRelative } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
  Note,
  PageHead,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface TeamMember {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  two_factor_enabled: boolean;
  last_active_at: string | null;
  is_you: boolean;
}

export interface MatrixRow {
  permission: string;
  role: string;
  allowed: boolean;
}

const ROLES = ["super_admin", "support", "finance", "content", "developer"] as const;

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  support: "Support",
  finance: "Finance",
  content: "Content",
  developer: "Developer",
};

const PERMISSION_LABEL: Record<string, string> = {
  see_teachers: "See teacher accounts",
  reset_passwords: "Reset passwords",
  view_as_teacher: "View as a teacher",
  grant_allowance: "Grant resources or AI images",
  change_plan: "Change a plan or price",
  issue_refunds: "Issue refunds",
  edit_copy: "Edit website copy",
  onboard_school: "Onboard a school",
  toggle_tools: "Turn tools on and off",
  manage_admins: "Manage admins",
  export_personal_data: "Export personal data",
};

// Display order matters here — it reads as a story from least to most
// sensitive, which is how someone auditing it will scan.
const PERMISSION_ORDER = [
  "see_teachers",
  "reset_passwords",
  "view_as_teacher",
  "grant_allowance",
  "change_plan",
  "issue_refunds",
  "edit_copy",
  "onboard_school",
  "toggle_tools",
  "manage_admins",
  "export_personal_data",
];

export default function TeamView({
  members,
  matrix,
  canManage,
}: {
  members: TeamMember[];
  matrix: MatrixRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [toastNode, fire] = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const byPermission = useMemo(() => {
    const map = new Map<string, Map<string, boolean>>();
    for (const m of matrix) {
      if (!map.has(m.permission)) map.set(m.permission, new Map());
      map.get(m.permission)!.set(m.role, m.allowed);
    }
    return map;
  }, [matrix]);

  const permissions = useMemo(() => {
    const present = [...byPermission.keys()];
    const ordered = PERMISSION_ORDER.filter((p) => present.includes(p));
    return [...ordered, ...present.filter((p) => !PERMISSION_ORDER.includes(p))];
  }, [byPermission]);

  const setRole = async (userId: string, role: string, email: string) => {
    setSaving(userId);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_role", { uid: userId, p_role: role });
    setSaving(null);
    if (error) {
      fire(error.message);
      return;
    }
    fire(`${email} is now ${ROLE_LABEL[role]}.`);
    router.refresh();
  };

  const noTwoFactor = members.filter((m) => !m.two_factor_enabled).length;

  return (
    <>
      <PageHead
        title="Team & roles"
        sub="Who on your side can see what. Partners, support staff and your developer shouldn't all have the same access."
      />

      {!canManage && (
        <div className="mb-4">
          <Note tone="warn">
            Your role can view the team but not change roles. Only a <b>super admin</b> can.
          </Note>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
          {noTwoFactor > 0 && <Tag tone="warn">{noTwoFactor} without 2FA</Tag>}
        </CardHeader>
        <Table>
          <thead>
            <tr className="text-left">
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Last active</Th>
              <Th align="center">2FA</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <Tr key={m.user_id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: C.ink }}>
                      {m.name ?? m.email}
                    </span>
                    {m.is_you && <Tag>you</Tag>}
                  </div>
                  {m.name && (
                    <div className="font-mono text-xs" style={{ color: C.muted }}>
                      {m.email}
                    </div>
                  )}
                </Td>
                <Td>
                  {canManage ? (
                    <select
                      value={m.role}
                      disabled={saving === m.user_id}
                      onChange={(e) => setRole(m.user_id, e.target.value, m.email)}
                      className={inputClass}
                      style={inputStyle}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Tag tone="brand">{ROLE_LABEL[m.role] ?? m.role}</Tag>
                  )}
                </Td>
                <Td>
                  <span className="text-xs" style={{ color: C.ink2 }}>
                    {fmtRelative(m.last_active_at)}
                  </span>
                </Td>
                <Td align="center">
                  {m.two_factor_enabled ? (
                    <Tag tone="ok">On</Tag>
                  ) : (
                    <Tag tone="danger">Off</Tag>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <CardFooter>
          Roles are an extra check on top of admin access, not a replacement — every admin
          action is still gated on being an admin first. An admin with no role assigned is
          treated as super admin.
        </CardFooter>
      </Card>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>What each role can do</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Permission</Th>
                {ROLES.map((r) => (
                  <Th key={r} align="center">
                    {ROLE_LABEL[r]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <Tr key={p}>
                  <Td>
                    <span className="font-medium" style={{ color: C.ink }}>
                      {PERMISSION_LABEL[p] ?? p}
                    </span>
                  </Td>
                  {ROLES.map((r) => {
                    const allowed = byPermission.get(p)?.get(r) ?? false;
                    return (
                      <Td key={r} align="center">
                        <span
                          className="font-bold"
                          style={{ color: allowed ? C.ok : C.muted }}
                          title={allowed ? "Allowed" : "Not allowed"}
                        >
                          {allowed ? "✓" : "—"}
                        </span>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </tbody>
          </Table>
          <CardFooter>
            Enforced in the database, not just hidden in the UI — a role that can&apos;t issue
            refunds is refused by the server even if the request is made directly.
          </CardFooter>
        </Card>
      </div>

      {toastNode}
    </>
  );
}

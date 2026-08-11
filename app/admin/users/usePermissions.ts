"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/auth/client";

// Which staff permissions the current admin holds, for gating the Teachers tab.
//
// This is UX only — every route re-checks server-side via requireAdminRoute(),
// which is the actual boundary. The point here is that a support admin sees
// straight away that Refund isn't theirs to press, rather than finding out from
// a 403 after filling in a reason.
//
// Note an is_admin user with no admin_team row resolves to super_admin in the
// DB (20260805001700_content_and_roles.sql), so existing admins keep everything
// until someone assigns them a narrower role.

export function usePermissions() {
  const [perms, setPerms] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_my_permissions");
      if (cancelled) return;
      if (error || !data) {
        // Leave perms null — `can()` stays false, so destructive buttons remain
        // disabled rather than being offered on a failed lookup.
        console.warn("[usePermissions]", error?.message);
        setPerms(new Set());
        return;
      }
      const rows = data as { permission: string; allowed: boolean }[];
      setPerms(new Set(rows.filter((r) => r.allowed).map((r) => r.permission)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    /** Still resolving — callers keep destructive actions disabled until false. */
    loading: perms === null,
    can: (permission: string) => perms?.has(permission) ?? false,
  };
}

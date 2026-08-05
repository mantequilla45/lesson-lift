"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { nf } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  EmptyState,
  Field,
  Modal,
  Note,
  PageHead,
  Table,
  Tag,
  Td,
  Th,
  Toggle,
  Tr,
  fieldClass,
  fieldStyle,
  useToast,
} from "../ui";

export interface EmailTemplate {
  key: string;
  name: string;
  trigger_description: string;
  subject: string | null;
  body: string | null;
  live: boolean;
  sent_30d: number | null;
  open_rate: number | null;
  click_rate: number | null;
}

export default function EmailsView({ rows }: { rows: EmailTemplate[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [toastNode, fire] = useToast();

  const toggleLive = async (key: string, live: boolean, name: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_email_template", {
      p_key: key,
      payload: { live },
    });
    if (error) {
      fire(error.message);
      return;
    }
    fire(`${name} ${live ? "enabled" : "turned off"}.`);
    router.refresh();
  };

  // Nothing sends these yet, so there is no engagement data to show. Rather
  // than render invented open rates, the columns are omitted entirely.
  const hasStats = rows.some((r) => r.sent_30d !== null);

  return (
    <>
      <PageHead
        title="Email templates"
        sub="Every automatic email Jooma sends. Edit the wording and control which are active."
      />

      <div className="mb-4">
        <Note tone="warn">
          <b>No email provider is configured</b>, so none of these are actually sent yet —
          Supabase Auth handles verification and password resets on its own templates. This
          page records the wording and which are meant to be live; delivery and open rates
          arrive when a provider is wired up.
        </Note>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No templates" />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Template</Th>
                <Th>Sent when</Th>
                <Th>Subject</Th>
                {hasStats && (
                  <>
                    <Th align="right">Sent (30d)</Th>
                    <Th align="right">Opened</Th>
                  </>
                )}
                <Th align="center">Live</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <Tr key={t.key}>
                  <Td>
                    <div className="font-semibold" style={{ color: C.ink }}>
                      {t.name}
                    </div>
                    <div className="font-mono text-xs" style={{ color: C.muted }}>
                      {t.key}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {t.trigger_description}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm" style={{ color: t.subject ? C.ink : C.muted }}>
                      {t.subject ?? "Not written"}
                    </span>
                  </Td>
                  {hasStats && (
                    <>
                      <Td align="right" mono>
                        {t.sent_30d === null ? "—" : nf.format(Number(t.sent_30d))}
                      </Td>
                      <Td align="right" mono>
                        {t.open_rate === null ? "—" : `${Number(t.open_rate).toFixed(0)}%`}
                      </Td>
                    </>
                  )}
                  <Td align="center">
                    <div className="flex justify-center">
                      <Toggle
                        on={t.live}
                        onChange={(next) => toggleLive(t.key, next, t.name)}
                        label={t.name}
                      />
                    </div>
                  </Td>
                  <Td align="right">
                    <Btn size="sm" onClick={() => setEditing(t)}>
                      Edit
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <CardFooter>
          {nf.format(rows.length)} templates ·{" "}
          {nf.format(rows.filter((r) => r.live).length)} marked live
        </CardFooter>
      </Card>

      {editing && (
        <EditEmailModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            fire(msg);
            router.refresh();
          }}
        />
      )}
      {toastNode}
    </>
  );
}

function EditEmailModal({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_update_email_template", {
      p_key: template.key,
      payload: { subject, body },
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved(`${template.name} saved.`);
    onClose();
  };

  return (
    <Modal
      title={`Edit ${template.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Btn>
        </>
      }
    >
      <Field label="Sent when">
        <p className="text-sm" style={{ color: C.ink2 }}>
          {template.trigger_description}
        </p>
      </Field>

      <Field label="Subject">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Field
        label="Body"
        help="Plain text for now. {curly braces} mark values filled in at send time."
      >
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {first_name},"
          className={`${fieldClass} resize-none`}
          style={fieldStyle}
        />
      </Field>

      <Note>
        Saving records the wording. Nothing sends until an email provider is configured.
      </Note>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

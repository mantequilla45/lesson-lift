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

export default function EmailsView({
  rows,
  mailerReady,
  renderableKeys,
}: {
  rows: EmailTemplate[];
  /** SendGrid keys present — i.e. anything can send at all. */
  mailerReady: boolean;
  /** Keys with a renderer in app/lib/email-templates. A row without one is a
   *  wording record and nothing more, however live it claims to be. */
  renderableKeys: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [toastNode, fire] = useToast();

  const renderable = new Set(renderableKeys);
  const orphans = rows.filter((r) => !renderable.has(r.key));

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

  // Engagement columns appear only once there is real data behind them. Nothing
  // writes sent_30d/open_rate yet — that needs SendGrid's event webhook — so
  // rather than render invented open rates the columns are omitted entirely.
  const hasStats = rows.some((r) => r.sent_30d !== null);

  return (
    <>
      <PageHead
        title="Email templates"
        sub="Every automatic email Jooma sends. Edit the wording and control which are active."
      />

      <div className="mb-4 space-y-2">
        {!mailerReady ? (
          <Note tone="warn">
            <b>No email provider is configured</b> — SENDGRID_API_KEY and
            SENDGRID_FROM_EMAIL are not both set in this environment, so nothing sends
            here. Wording saved on this page still applies once they are.
          </Note>
        ) : (
          <Note>
            <b>SendGrid is configured</b>, so the templates below with a renderer send for
            real. Turning one off here stops it immediately.
          </Note>
        )}
        {orphans.length > 0 && (
          <Note tone="warn">
            <b>
              {orphans.length} of these {rows.length} have no renderer in the code
            </b>{" "}
            and cannot send whatever their status says — they are wording records waiting
            on the feature that would trigger them. They are marked <b>No renderer</b>{" "}
            below.
          </Note>
        )}
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
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold" style={{ color: C.ink }}>
                        {t.name}
                      </span>
                      {!renderable.has(t.key) && (
                        <Tag tone="warn" title="No renderer in the code — this cannot send">
                          No renderer
                        </Tag>
                      )}
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
          sends={mailerReady && renderable.has(editing.key)}
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
  sends,
  onClose,
  onSaved,
}: {
  template: EmailTemplate;
  /** Provider configured AND this template has a renderer. */
  sends: boolean;
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

      <Note tone={sends ? "warn" : "brand"}>
        {sends
          ? "This template sends for real. Saving changes the wording of the next one that goes out."
          : "Saving records the wording. This template has nothing to trigger it yet, so it won't send."}
      </Note>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

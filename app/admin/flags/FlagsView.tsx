"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { typeLabel } from "@/app/lib/toolRunDisplay";
import { fmtDateTime, fmtRelative, nf } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  Note,
  PageHead,
  Stat,
  StatusTag,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  fieldClass,
  fieldStyle,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface FlagRow {
  id: string;
  user_id: string | null;
  teacher: string;
  email: string | null;
  tool_slug: string | null;
  reason: string;
  excerpt: string | null;
  severity: string;
  status: string;
  review_note: string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  created_at: string;
  run_id: string | null;
  /** Resolved from run_id when the teacher saved the generation; null if not. */
  tool_run_id: string | null;
  run_title: string | null;
}

export interface FlagSummary {
  flagged_30d: number;
  awaiting_review: number;
  confirmed: number;
  cleared: number;
  oldest_open: string | null;
  generations_30d: number;
}

const SEVERITY_TONE: Record<string, "danger" | "warn" | "plain"> = {
  high: "danger",
  medium: "warn",
  low: "plain",
};

export default function FlagsView({
  rows,
  summary,
}: {
  rows: FlagRow[];
  summary: FlagSummary | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [reviewing, setReviewing] = useState<FlagRow | null>(null);
  const [toastNode, fire] = useToast();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((f) => {
      if (status && f.status !== status) return false;
      if (needle && !`${f.teacher} ${f.reason} ${f.tool_slug ?? ""}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [rows, q, status]);

  const flagged = Number(summary?.flagged_30d ?? 0);
  const gens = Number(summary?.generations_30d ?? 0);
  const rate = gens > 0 ? (flagged / gens) * 100 : 0;

  return (
    <>
      <PageHead
        title="Safeguarding flags"
        sub="What teachers typed that looked like a pupil safeguarding disclosure. Review it, decide, and the decision is logged."
      />

      {/* What this page is. Without this, the table is a list of accusations
          with no stated basis — nobody can review a flag fairly if they don't
          know what produced it. */}
      <div className="mb-6 space-y-3">
        <Note>
          <b>What triggers a flag.</b> Jooma scans what a teacher <b>types into</b> a tool — not
          what it generates — for language that looks like a real pupil safeguarding disclosure:
          reported speech about self-harm, abuse or neglect, especially alongside a named child.
          Writing a lesson, policy or assembly <i>about</i> those topics does not flag. A teacher
          writing up what a child told them does.
        </Note>
        <Note>
          <b>What the severities mean.</b>{" "}
          <Tag tone="danger">high</Tag> looks like a genuine disclosure about an identifiable
          child — review promptly. <Tag tone="warn">medium</Tag> is concerning language without a
          clear disclosure shape. <Tag>low</Tag> is worth a glance; most of these turn out to be
          legitimate curriculum work.
        </Note>
        <Note>
          <b>What your decision does.</b> <b>Confirm</b> records that this was a genuine
          safeguarding matter and that you saw it. <b>Clear</b> records it as a false positive.
          Neither notifies the teacher, and both are written to the audit log with your name and
          the time.
        </Note>
        <Note tone="warn">
          <b>Nothing here blocked a generation.</b> This is a review trail, not a filter — the
          teacher got their output either way. It covers the text tools; slideshow decks and
          non-streaming tools are not scanned yet.
        </Note>
      </div>

      <div className="grid gap-3.5 mb-6 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Flagged (30d)"
          value={nf.format(flagged)}
          foot={gens > 0 ? `${rate.toFixed(3)}% of generations` : "no generations yet"}
        />
        <Stat
          label="Awaiting review"
          value={nf.format(Number(summary?.awaiting_review ?? 0))}
          foot={
            summary?.oldest_open ? `oldest ${fmtRelative(summary.oldest_open)}` : "nothing open"
          }
        />
        <Stat
          label="Confirmed issues"
          value={nf.format(Number(summary?.confirmed ?? 0))}
          foot="in the last 30 days"
        />
        <Stat
          label="Cleared"
          value={nf.format(Number(summary?.cleared ?? 0))}
          foot="false positives"
        />
      </div>

      <Card>
        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Teacher, reason or tool"
            className={inputClass}
            style={{ ...inputStyle, minWidth: 230 }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Any status</option>
            <option value="review">Needs review</option>
            <option value="confirmed">Confirmed</option>
            <option value="cleared">Cleared</option>
          </select>
          <div className="flex-1" />
          <Tag>{nf.format(filtered.length)} shown</Tag>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "Nothing flagged" : "Nothing matches that"}
            body={
              rows.length === 0
                ? "Nothing a teacher has typed has looked like a pupil safeguarding disclosure. This is the healthy state, and the one you want to be able to show a school."
                : "Try clearing a filter."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th>When</Th>
                <Th>Teacher</Th>
                <Th>Tool</Th>
                <Th>Why it flagged</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <Tr key={f.id} clickable onClick={() => setReviewing(f)}>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {fmtDateTime(f.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <div className="font-medium" style={{ color: C.ink }}>
                      {f.teacher}
                    </div>
                    {f.email && (
                      <div className="text-xs" style={{ color: C.muted }}>
                        {f.email}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {f.tool_slug ? typeLabel(f.tool_slug) : "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm" style={{ color: C.ink }}>
                      {f.reason}
                    </span>
                  </Td>
                  <Td>
                    <Tag tone={SEVERITY_TONE[f.severity] ?? "plain"}>{f.severity}</Tag>
                  </Td>
                  <Td>
                    <StatusTag status={f.status} />
                  </Td>
                  <Td align="right">
                    <Btn size="sm" onClick={() => setReviewing(f)}>
                      Review
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <CardFooter>
          Every review is recorded in the audit log with who decided and when.
        </CardFooter>
      </Card>

      <div className="mt-4">
        <Note>
          <b>Why this matters:</b> UK schools ask about safeguarding and data protection
          before they&apos;ll sign. Being able to open this page in a sales call is worth more
          than any slide.
        </Note>
      </div>

      {reviewing && (
        <ReviewModal
          flag={reviewing}
          onClose={() => setReviewing(null)}
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

function ReviewModal({
  flag,
  onClose,
  onSaved,
}: {
  flag: FlagRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [note, setNote] = useState(flag.review_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (status: "confirmed" | "cleared") => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_review_flag", {
      flag_id: flag.id,
      p_status: status,
      p_note: note || null,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved(`Flag marked ${status}.`);
    onClose();
  };

  return (
    <Modal
      title="Review flag"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => decide("cleared")} disabled={saving}>
            Clear — false positive
          </Btn>
          <Btn variant="danger" onClick={() => decide("confirmed")} disabled={saving}>
            Confirm issue
          </Btn>
        </>
      }
    >
      <div
        className="rounded-xl border px-3.5 py-3 mb-4 text-sm"
        style={{ borderColor: C.border, backgroundColor: C.white }}
      >
        {[
          ["Teacher", flag.teacher],
          ["Tool", flag.tool_slug ? typeLabel(flag.tool_slug) : "—"],
          ["When", fmtDateTime(flag.created_at)],
          ["Severity", flag.severity],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5">
            <span style={{ color: C.muted }}>{k}</span>
            <span style={{ color: C.ink }}>{v}</span>
          </div>
        ))}
      </div>

      <Field label="Why it flagged">
        <p className="text-sm" style={{ color: C.ink }}>
          {flag.reason}
        </p>
      </Field>

      {flag.excerpt && (
        <Field
          label="Excerpt"
          help="A short extract of what the teacher typed, capped at 300 characters — the full prompt is never copied here."
        >
          <div
            className="rounded-lg border px-3 py-2 text-sm font-mono"
            style={{ borderColor: C.border, backgroundColor: C.white, color: C.ink2 }}
          >
            {flag.excerpt}
          </div>
        </Field>
      )}

      <Field label="The generation">
        {flag.tool_run_id ? (
          <p className="text-sm" style={{ color: C.ink }}>
            Saved as{" "}
            <span className="font-medium">{flag.run_title || "an untitled run"}</span> — open it
            from the teacher&apos;s history to see the full context.
          </p>
        ) : (
          <p className="text-sm" style={{ color: C.muted }}>
            The teacher did not save this generation, so there is no output to open. The excerpt
            above is what triggered the flag.
          </p>
        )}
      </Field>

      <Field label="Review note" help="Recorded against the flag and in the audit log.">
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you decide, and why?"
          className={`${fieldClass} resize-none`}
          style={fieldStyle}
        />
      </Field>

      {flag.reviewed_at && (
        <Note>
          Previously reviewed by {flag.reviewer ?? "an admin"} on{" "}
          {fmtDateTime(flag.reviewed_at)}. Reviewing again replaces that decision.
        </Note>
      )}

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { fmtDateTime, nf } from "../format";
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
  Table,
  Tag,
  Td,
  Th,
  Timeline,
  TimelineItem,
  Tr,
  fieldClass,
  fieldStyle,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface CopyBlock {
  key: string;
  where_shown: string;
  value: string | null;
  draft: string | null;
  version: number;
  live: boolean;
  has_draft: boolean;
  updated_at: string;
}

export default function CopyView({
  rows,
  canEdit,
}: {
  rows: CopyBlock[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [where, setWhere] = useState("");
  const [editing, setEditing] = useState<CopyBlock | null>(null);
  const [toastNode, fire] = useToast();

  const places = useMemo(
    () => [...new Set(rows.map((r) => r.where_shown))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (where && r.where_shown !== where) return false;
      if (needle && !`${r.key} ${r.value ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, where]);

  const drafts = rows.filter((r) => r.has_draft).length;

  const publishAll = async () => {
    const supabase = createClient();
    const pending = rows.filter((r) => r.has_draft);
    let ok = 0;
    for (const r of pending) {
      const { error } = await supabase.rpc("admin_publish_copy", { p_key: r.key });
      if (!error) ok += 1;
    }
    fire(
      ok === pending.length
        ? `${ok} change${ok === 1 ? "" : "s"} published.`
        : `${ok} of ${pending.length} published — the rest failed.`,
    );
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Website & app copy"
        sub="Every bit of text on jooma.ai and in the teacher dashboard, editable without touching code."
      >
        {canEdit && drafts > 0 && (
          <Btn variant="primary" onClick={publishAll}>
            Publish {nf.format(drafts)} change{drafts === 1 ? "" : "s"}
          </Btn>
        )}
      </PageHead>

      {!canEdit && (
        <div className="mb-4">
          <Note tone="warn">
            Your role can view copy but not change it. Editing is limited to the{" "}
            <b>content</b> and <b>super admin</b> roles.
          </Note>
        </div>
      )}

      {drafts > 0 && (
        <div className="mb-4">
          <Note>
            <b>
              {nf.format(drafts)} unpublished change{drafts === 1 ? "" : "s"}.
            </b>{" "}
            Everything edits as a draft first, so nothing goes live by accident. Every block
            keeps its version history and can be rolled back.
          </Note>
        </div>
      )}

      <Card>
        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search copy or key"
            className={inputClass}
            style={{ ...inputStyle, minWidth: 230 }}
          />
          <select
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Everywhere</option>
            {places.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          {drafts > 0 && <Tag tone="warn">{nf.format(drafts)} draft{drafts === 1 ? "" : "s"}</Tag>}
          <Tag>{nf.format(filtered.length)} shown</Tag>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState title="No copy blocks match that" body="Try clearing a filter." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th width="200px">Key</Th>
                <Th>Where</Th>
                <Th>Text</Th>
                <Th>Version</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Tr key={r.key} clickable onClick={() => setEditing(r)}>
                  <Td>
                    <span className="font-mono text-xs" style={{ color: C.ink }}>
                      {r.key}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {r.where_shown}
                    </span>
                  </Td>
                  <Td>
                    <div className="max-w-md truncate" style={{ color: C.ink }}>
                      {r.has_draft ? r.draft : r.value}
                    </div>
                    {r.has_draft && (
                      <div className="text-xs truncate max-w-md" style={{ color: C.muted }}>
                        Live: {r.value ?? "—"}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs tabular-nums" style={{ color: C.ink2 }}>
                        v{r.version}
                      </span>
                      {r.has_draft ? (
                        <Tag tone="warn">Draft</Tag>
                      ) : r.live ? (
                        <Tag tone="ok">Live</Tag>
                      ) : (
                        <Tag>Not published</Tag>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    <Btn size="sm" onClick={() => setEditing(r)}>
                      {canEdit ? "Edit" : "View"}
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <CardFooter>
          Anything in {"{curly braces}"} is filled in automatically — leave it alone. Teacher
          and marketing surfaces read published values only.
        </CardFooter>
      </Card>

      {editing && (
        <EditCopyModal
          block={editing}
          canEdit={canEdit}
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

interface HistoryRow {
  version: number;
  value: string;
  published_by_email: string | null;
  published_at: string;
}

function EditCopyModal({
  block,
  canEdit,
  onClose,
  onSaved,
}: {
  block: CopyBlock;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [text, setText] = useState(block.draft ?? block.value ?? "");
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_copy_history", { p_key: block.key });
    setHistory((data ?? []) as HistoryRow[]);
  };

  const save = async (publish: boolean) => {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: draftErr } = await supabase.rpc("admin_save_copy_draft", {
      p_key: block.key,
      p_draft: text,
    });
    if (draftErr) {
      setSaving(false);
      setError(draftErr.message);
      return;
    }

    if (publish) {
      const { error: pubErr } = await supabase.rpc("admin_publish_copy", { p_key: block.key });
      if (pubErr) {
        setSaving(false);
        setError(pubErr.message);
        return;
      }
    }

    setSaving(false);
    onSaved(publish ? "Published to jooma.ai." : "Saved as a draft.");
    onClose();
  };

  const changed = text !== (block.draft ?? block.value ?? "");

  return (
    <Modal
      title="Edit copy"
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn onClick={() => save(false)} disabled={saving || !changed}>
              Save draft
            </Btn>
            <Btn variant="primary" onClick={() => save(true)} disabled={saving}>
              {saving ? "Publishing…" : "Publish now"}
            </Btn>
          </>
        ) : (
          <Btn onClick={onClose}>Close</Btn>
        )
      }
    >
      <Field label="Key" help={`Where it appears: ${block.where_shown}`}>
        <div className="font-mono text-xs" style={{ color: C.ink }}>
          {block.key}
        </div>
      </Field>

      <Field
        label="Text"
        help="Anything in {curly braces} is filled in automatically — leave it alone."
      >
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canEdit}
          className={`${fieldClass} resize-none`}
          style={fieldStyle}
        />
      </Field>

      {block.has_draft && (
        <Note tone="warn">
          This block has an unpublished draft. The live site still shows:{" "}
          <i>{block.value ?? "nothing"}</i>
        </Note>
      )}

      <div className="mt-3">
        <Field label="Version history">
          {history === null ? (
            <Btn size="sm" onClick={loadHistory}>
              Load history
            </Btn>
          ) : history.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>
              No previous versions — this is the first.
            </p>
          ) : (
            <Timeline>
              <TimelineItem
                title={`v${block.version} — current`}
                meta={fmtDateTime(block.updated_at)}
                highlight
              />
              {history.map((h) => (
                <TimelineItem
                  key={h.version}
                  title={
                    <span title={h.value}>
                      v{h.version} — {h.value.slice(0, 60)}
                      {h.value.length > 60 ? "…" : ""}
                    </span>
                  }
                  meta={`${h.published_by_email ?? "—"} · ${fmtDateTime(h.published_at)}`}
                />
              ))}
            </Timeline>
          )}
        </Field>
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

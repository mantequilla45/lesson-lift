"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";
import { PLANS } from "@/app/lib/plans";

// Matches the mockup's bulkInvite() modal: a list of emails (or a CSV), which
// school pool to add them to, and which plan to put them on.
//
// Submission is deliberately stubbed — there's no invite-email flow yet
// (auth.admin.inviteUserByEmail + a mailer to actually send it), and no
// school entity in the schema to assign anyone to, so the school dropdown is
// a placeholder like the Teachers table's School column.

const fieldClass =
  "w-full px-3.5 py-2.5 border rounded-xl bg-white text-sm font-medium placeholder-[#A5A5A5] focus:outline-none focus:border-[#1a1a1a] transition-colors";
const fieldStyle = { borderColor: "#DAD8D0" };

export default function InviteTeachersModal({ onClose }: { onClose: () => void }) {
  const [emails, setEmails] = useState("");
  const [plan, setPlan] = useState<string>(PLANS.free.id);
  const [notice, setNotice] = useState<string | null>(null);

  const parsed = emails
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const canSubmit = parsed.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setNotice("Inviting teachers isn't wired up yet.");
  };

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]"
        style={{ borderColor: "#DAD8D0", backgroundColor: "#FAF9F5" }}
      >
        <div className="flex items-start gap-3 p-6 pb-4 border-b shrink-0" style={{ borderColor: "#DAD8D0" }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#EEECE4" }}
          >
            <Mail className="w-5 h-5" style={{ color: "#1a1a1a" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold" style={{ color: "#1a1a1a" }}>
              Invite teachers
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "#8a8078" }}>
              Send an invite link to one or more teachers by email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5"
            style={{ color: "#8a8078" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a423a" }}>
                Email addresses
              </label>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={5}
                placeholder="One per line, or paste a comma-separated list"
                className={`${fieldClass} resize-none`}
                style={fieldStyle}
              />
              <p className="mt-1.5 text-xs" style={{ color: "#8a8078" }}>
                Or{" "}
                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="underline hover:no-underline"
                  style={{ color: "#1a1a1a" }}
                >
                  upload a CSV
                </button>{" "}
                with name, email, year group.
                {parsed.length > 0 && ` ${parsed.length} email${parsed.length === 1 ? "" : "s"} detected.`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a423a" }}>
                Add to
              </label>
              <select disabled title="No school data yet" className={`${fieldClass} opacity-50 cursor-not-allowed`} style={fieldStyle}>
                <option>No school — individual accounts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a423a" }}>
                Plan
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              >
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-2 p-6 pt-4 border-t shrink-0"
            style={{ borderColor: "#DAD8D0" }}
          >
            <p className="text-xs" style={{ color: notice ? "#A85F0C" : "#8a8078" }}>
              {notice ?? " "}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold rounded-xl border px-4 py-2 transition-colors hover:bg-black/5"
                style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="text-sm font-semibold rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                Send invites
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Suspending blocks sign-in and revokes any live session, so it takes effect
// immediately for the teacher. Worth a confirm step and a reason rather than a
// bare button — and the email is opt-in, because plenty of suspensions are
// internal housekeeping (a duplicate account, a billing hold) where mailing the
// teacher would confuse more than it explains.

const fieldClass =
  "w-full px-3.5 py-2.5 border rounded-xl bg-white text-sm font-medium placeholder-[#A5A5A5] focus:outline-none focus:border-[#1a1a1a] transition-colors";
const fieldStyle = { borderColor: "#DAD8D0" };

export default function SuspendModal({
  userId,
  name,
  suspend,
  onClose,
  onDone,
}: {
  userId: string;
  name: string;
  /** true = suspending, false = lifting an existing suspension */
  suspend: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/teachers/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, suspend, reason: reason.trim(), notify }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not update the account.");
      setSaving(false);
      return;
    }
    onDone(
      suspend
        ? json.emailed
          ? "Account suspended and the teacher was emailed."
          : "Account suspended."
        : "Suspension lifted — they can sign in again.",
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-1010 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
        style={{ borderColor: "#DAD8D0", backgroundColor: "#FAF9F5" }}
      >
        <div className="flex items-start gap-3 p-5 pb-4 border-b" style={{ borderColor: "#DAD8D0" }}>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold" style={{ color: "#1a1a1a" }}>
              {suspend ? "Suspend account" : "Lift suspension"}
            </h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: "#8a8078" }}>
              {name}
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

        <div className="p-5 space-y-4">
          <div
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{
              backgroundColor: suspend ? "#FBECEB" : "#F1EFE9",
              color: suspend ? "#B3261E" : "#6b6055",
            }}
          >
            {suspend
              ? "They'll be signed out everywhere and won't be able to sign in again until you lift this. Their saved resources are kept."
              : "They'll be able to sign in again straight away."}
          </div>

          {suspend && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4a423a" }}>
                  Reason
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Goes in the audit log"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              <label className="flex items-start gap-2 text-sm" style={{ color: "#4a423a" }}>
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Email them about it
                  {reason.trim() && <span style={{ color: "#8a8078" }}> — the reason above is included</span>}
                </span>
              </label>
            </>
          )}

          {error && (
            <p className="text-sm" style={{ color: "#B3261E" }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 pt-0">
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
            disabled={saving}
            className="text-sm font-semibold rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: suspend ? "#B3261E" : "#1a1a1a" }}
          >
            {saving ? "Working…" : suspend ? "Suspend" : "Lift suspension"}
          </button>
        </div>
      </form>
    </div>
  );
}

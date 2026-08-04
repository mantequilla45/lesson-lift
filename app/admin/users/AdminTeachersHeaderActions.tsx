"use client";

import { useState } from "react";
import { Download, UserPlus, Plus } from "lucide-react";
import AddTeacherModal from "./AddTeacherModal";

// Export and Invite still need backend work that doesn't exist yet (CSV
// export, an invite-email flow via auth.admin.inviteUserByEmail + a mailer),
// so they stay honest stubs — clicking says so rather than pretending to
// work. Add teacher opens a real modal with the signup form's fields; see
// AddTeacherModal for why its submit is still stubbed.
const NOTES: Record<string, string> = {
  export: "CSV export isn't wired up yet.",
  invite: "Inviting teachers isn't wired up yet.",
};

export default function AdminTeachersHeaderActions() {
  const [note, setNote] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fire = (key: keyof typeof NOTES) => {
    setNote(NOTES[key]);
    window.setTimeout(() => setNote((n) => (n === NOTES[key] ? null : n)), 3000);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fire("export")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl border px-4 py-2 transition-colors hover:bg-black/5"
          style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <button
          type="button"
          onClick={() => fire("invite")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl border px-4 py-2 transition-colors hover:bg-black/5"
          style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
        >
          <UserPlus className="w-4 h-4" />
          Invite teachers
        </button>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <Plus className="w-4 h-4" />
          Add teacher
        </button>
      </div>
      {note && (
        <p className="text-xs" style={{ color: "#8a8078" }}>
          {note}
        </p>
      )}

      {showAdd && <AddTeacherModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

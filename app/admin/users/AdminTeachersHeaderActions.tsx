"use client";

import { useState } from "react";
import { UserPlus, Plus } from "lucide-react";
import AddTeacherModal from "./AddTeacherModal";
import InviteTeachersModal from "./InviteTeachersModal";

// Export used to live here as a stub. It now sits in the table's own filter
// bar instead: the filter state lives there, so the button can export exactly
// the rows on screen rather than needing that state plumbed up to the header.

export default function AdminTeachersHeaderActions() {
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl border px-4 py-2 transition-colors hover:bg-black/5"
          style={{ borderColor: "#EAE6F5", color: "#1D1730" }}
        >
          <UserPlus className="w-4 h-4" />
          Invite teachers
        </button>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#5B2ED6" }}
        >
          <Plus className="w-4 h-4" />
          Add teacher
        </button>
      </div>

      {showAdd && <AddTeacherModal onClose={() => setShowAdd(false)} />}
      {showInvite && <InviteTeachersModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

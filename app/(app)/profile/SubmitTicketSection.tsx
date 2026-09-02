"use client";

// Submit ticket — the same composer /help uses, in the profile shell.
//
// The form itself is shared (app/help/NewConversation.tsx). What differs is
// where a teacher lands afterwards: /help can open the new thread in the pane
// beside the list, and this page has no list, so it offers the link instead.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import NewConversation from "@/app/(app)/help/NewConversation";

export default function SubmitTicketSection() {
  const router = useRouter();
  const [sentId, setSentId] = useState<string | null>(null);

  return (
    <div
      className="rounded-3xl p-6 sm:p-8 border"
      style={{ backgroundColor: "var(--j-card)", borderColor: "var(--j-line)" }}
    >
      {sentId ? (
        <div className="max-w-lg">
          <CheckCircle2 className="w-8 h-8 mb-3" style={{ color: "#1f6b3b" }} />
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--j-ink)" }}>
            Message sent
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--j-faint)" }}>
            We&apos;ll get back to you, usually within a working day. You can
            follow the conversation and add anything you forgot in Help.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/help?thread=${sentId}`}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--j-ink)" }}
            >
              View conversation
            </Link>
            <button
              type="button"
              onClick={() => setSentId(null)}
              className="text-sm font-semibold transition-opacity hover:opacity-70 cursor-pointer"
              style={{ color: "var(--j-faint)" }}
            >
              Send another
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--j-ink)" }}>
            Submit ticket
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--j-faint)" }}>
            Send a message to our support team.
          </p>
          <NewConversation
            heading={false}
            onCreated={(id) => {
              setSentId(id);
              // Keeps the Help badge in the sidebar honest — the new thread
              // counts toward it the moment it exists.
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}

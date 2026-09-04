"use client";

// The confirmation both forms show after a successful send.
//
// It names the reference and says where the reply will come from. A form that
// just clears itself leaves the person wondering whether it worked, and the
// address matters because our reply arrives from info@jooma.ai rather than the
// noreply@ sender the rest of the product uses.

import { CheckCircle2 } from "lucide-react";

export default function Sent({
  reference,
  email,
  onAgain,
}: {
  reference: string;
  email: string;
  onAgain: () => void;
}) {
  return (
    <div className="max-w-xl">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#1f6b3b" }} />
        <div>
          <h3 className="text-xl font-medium mb-1">Thanks, that is with us</h3>
          <p className="text-sm font-light" style={{ color: "var(--j-muted)" }}>
            We usually reply within one working day
            {email ? (
              <>
                , to <strong style={{ color: "var(--j-ink)" }}>{email}</strong>
              </>
            ) : null}
            .
          </p>
          {reference && (
            <p className="text-xs font-mono mt-2" style={{ color: "var(--j-faint)" }}>
              Reference {reference}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onAgain}
        className="mt-5 px-5 py-2.5 rounded-2xl text-sm font-semibold border transition-colors cursor-pointer hover:bg-black/3"
        style={{ borderColor: "var(--j-line)", color: "var(--j-ink)" }}
      >
        Send another
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import TopUpModal from "@/app/components/v2/TopUpModal";

// Buys credit from the billing page's allowance meter.
//
// Opens the same modal the sidebar uses rather than buying instantly. There is
// more than one pack now, so a button that charged a card the moment it was
// pressed would be choosing on the teacher's behalf; and two entry points
// offering different things is how the sidebar and this page drifted apart the
// last time.
//
// The credit is granted by the webhook once Stripe confirms payment, never
// here. Repeatable: each purchase is an independent session.
export default function TopUpButton() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-block py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
      >
        Top up credits
      </button>
      <TopUpModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

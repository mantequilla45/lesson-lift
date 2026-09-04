"use client";

// The submit half of both enquiry forms.
//
// Split out because the two forms differ only in which fields they collect: the
// POST, the error handling and the success state are identical, and a second
// copy is a second place for them to rot. Same reasoning as the header of
// app/(app)/help/NewConversation.tsx.

import { useState } from "react";
import type { EnquiryPayload } from "@/app/lib/enquiry";

export function useEnquirySubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The reference, once sent. Non-null is what flips the form to its
   *  confirmation, so it doubles as the "done" flag. */
  const [reference, setReference] = useState<string | null>(null);

  const submit = async (payload: EnquiryPayload): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setBusy(false);
      setError("We could not reach the server. Check your connection and try again.");
      return false;
    }

    const json = (await res.json().catch(() => ({}))) as {
      reference?: string;
      error?: string;
    };
    setBusy(false);

    if (!res.ok) {
      // The route passes through what submit_enquiry() raised, which is written
      // to be read by the person who typed the form.
      setError(json.error ?? "That message could not be sent. Please try again.");
      return false;
    }

    setReference(json.reference ?? "");
    return true;
  };

  const reset = () => {
    setReference(null);
    setError(null);
  };

  return { busy, error, reference, submit, reset, setError };
}

// Reply to a contact or school enquiry, and email the person who sent it.
//
// The email is why this route exists: admin_enquiry_reply() is a database
// function and has no business talking to SendGrid.
//
// THE ONE RULE, as in /api/support/reply: internal notes must never be emailed.
// A note is written on the assumption the enquirer cannot see it, and mailing
// one is the single mistake in this feature that reaches a customer. The send
// sits in an `if (!isNote)` block rather than a ternary so it cannot be widened
// by accident.
//
// SENDER: this goes out from info@jooma.ai, not the global noreply@ that
// SENDGRID_FROM_EMAIL carries. A human reply to a school should come from an
// address a human answers, and Reply-To is set to the same so hitting Reply
// reaches a real mailbox. Everything else Jooma sends is automated and keeps
// noreply@.
import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTemplate } from "@/app/lib/email";

/** Overridable so the address can change without a deploy. */
const ENQUIRY_FROM = process.env.ENQUIRY_FROM_EMAIL || "info@jooma.ai";

export async function POST(req: Request) {
  const gate = await requireAdminRoute();
  if (gate.error) return gate.error;

  let payload: { enquiryId?: string; body?: string; isNote?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const enquiryId = payload.enquiryId?.trim();
  const body = payload.body?.trim();
  const isNote = payload.isNote === true;

  if (!enquiryId) {
    return NextResponse.json({ error: "Which enquiry?" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "A message body is required." }, { status: 400 });
  }

  // The RPC re-checks is_admin() itself and writes the audit log entry.
  const { data: replyId, error } = await gate.supabase.rpc("admin_enquiry_reply", {
    eid: enquiryId,
    p_body: body,
    is_note: isNote,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Saved. Everything below is best-effort: the reply is already durable, and a
  // mail failure must not read as a failed reply.
  let emailed = false;

  if (!isNote) {
    // Service role: the caller's RLS-bound client can read this row, but using
    // the same path as the support route keeps the two symmetrical.
    const { data: enquiry } = await supabaseAdmin
      .from("enquiries")
      .select("reference, name, email")
      .eq("id", enquiryId)
      .maybeSingle();

    if (enquiry?.email) {
      emailed = await sendTemplate(
        "enquiry_reply",
        enquiry.email,
        {
          name: enquiry.name ?? "",
          body,
          reference: enquiry.reference ?? "",
          replyTo: ENQUIRY_FROM,
        },
        { from: ENQUIRY_FROM, replyTo: ENQUIRY_FROM },
      );

      if (emailed) {
        // So the console can show "saved but not sent" honestly rather than
        // implying every recorded reply left the building.
        await gate.supabase.rpc("admin_enquiry_mark_emailed", { rid: replyId });
      }
    }
  }

  return NextResponse.json({ ok: true, replyId, emailed });
}

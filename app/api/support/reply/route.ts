// Post a support reply (or an internal note) and, for a real reply, email the
// teacher.
//
// The email is why this route exists at all: admin_reply() is a database
// function and has no business sending mail, and the previous UI called it
// directly from the browser and then toasted "Reply sent." while nothing left
// the building.
//
// THE ONE RULE: internal notes must never be emailed. A note is written on the
// assumption the teacher cannot see it — mailing one is the single mistake in
// this feature that reaches a customer. The gate is `isNote` below, and the
// send is in an `if (!isNote)` block rather than a ternary so it cannot be
// widened by accident.
import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTemplate } from "@/app/lib/email";

export async function POST(req: Request) {
  const gate = await requireAdminRoute();
  if (gate.error) return gate.error;

  let payload: { threadId?: string; body?: string; isNote?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const threadId = payload.threadId?.trim();
  const body = payload.body?.trim();
  const isNote = payload.isNote === true;

  if (!threadId) {
    return NextResponse.json({ error: "Which conversation?" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "A message body is required." }, { status: 400 });
  }

  // The RPC re-checks is_admin() itself and writes the audit log entry.
  const { data: messageId, error } = await gate.supabase.rpc("admin_reply", {
    tid: threadId,
    p_body: body,
    is_note: isNote,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Saved. Everything below is best-effort: the reply is already durable, and
  // a mail failure must not read as a failed reply.
  let emailed = false;

  if (!isNote) {
    // Service role because the recipient's address lives in auth.users, which
    // the caller's RLS-bound client cannot read.
    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("reference, subject, user_id")
      .eq("id", threadId)
      .maybeSingle();

    if (thread?.user_id) {
      const {
        data: { user: recipient },
      } = await supabaseAdmin.auth.admin.getUserById(thread.user_id);

      if (recipient?.email) {
        emailed = await sendTemplate("support_reply", recipient.email, {
          subject: thread.subject ?? "your message",
          body,
          reference: thread.reference ?? "",
          threadId,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, messageId, emailed });
}

// Public submission for the contact and school enquiry forms.
//
// This is the first endpoint in the codebase that writes on behalf of someone
// with no session, which is deliberate: a school asking about licences has no
// account yet and should not need one to reach us. That makes it the first place
// that needs a brake, so it has three, none of which need a new dependency:
//
//   1. A honeypot field. A bot that fills every input gets a 200 and no row, so
//      it learns nothing and does not retry.
//   2. An IP throttle, here, at 5 an hour.
//   3. A per-address throttle inside submit_enquiry(), at 3 an hour. That one
//      matters more: it survives someone changing network, and it is enforced
//      wherever the function is called from rather than only through this route.
//
// The write itself goes through submit_enquiry() rather than a table insert.
// There is no anon insert policy on `enquiries` and there must not be one: a
// policy grants the whole table where the function grants exactly one operation
// and returns only a reference.
import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { EMAIL_RE, type EnquiryPayload } from "@/app/lib/enquiry";

/** Submissions per IP per hour. Generous: a school office behind one NAT may
 *  legitimately send a few, and the per-address cap is the tighter one. */
const IP_LIMIT = 5;

/**
 * The caller's IP, as far as it can be trusted.
 *
 * x-forwarded-for is client-supplied and spoofable in general, but on Vercel the
 * platform appends the real peer, so the LAST entry is the one to use rather
 * than the first. A spoofed header therefore widens nothing: an attacker can
 * only ever add hops in front of their own.
 */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request) {
  let payload: EnquiryPayload;
  try {
    payload = (await req.json()) as EnquiryPayload;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Honeypot. A 200 with a plausible-looking reference: a bot that sees a 400
  // learns the field is a trap and comes back without it, and one that sees a
  // success does not come back at all.
  if (typeof payload.company === "string" && payload.company.trim() !== "") {
    return NextResponse.json({ ok: true, reference: "" });
  }

  const kind = payload.kind === "school" ? "school" : "contact";
  const name = (payload.name ?? "").trim();
  const email = (payload.email ?? "").trim().toLowerCase();
  const phone = (payload.phone ?? "").trim();
  const school = (payload.school ?? "").trim();

  // Cheap checks first so an obviously empty form never reaches the database.
  // submit_enquiry() re-checks all of it; this only saves a round trip.
  if (!name) {
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }
  if (kind === "school" && !school) {
    return NextResponse.json({ error: "Your school name is required." }, { status: 400 });
  }
  if (kind === "school" && !phone) {
    return NextResponse.json({ error: "A phone number is required." }, { status: 400 });
  }

  // ── IP throttle ────────────────────────────────────────────────────────────
  // Service role because enquiry_rate is admin-only like everything else here,
  // and this runs for a caller with no session at all.
  const ip = clientIp(req);
  if (ip !== "unknown") {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("enquiry_rate")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gt("created_at", since);

    if ((count ?? 0) >= IP_LIMIT) {
      return NextResponse.json(
        { error: "Thanks, we already have your message. We will be in touch." },
        // 429 with Retry-After, matching how generation-guard.ts reports a rate
        // limit. No x-upgrade-required here: there is nothing to upgrade to.
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  }

  // The caller's own client, so auth.uid() inside submit_enquiry() resolves to
  // the signed-in teacher and stamps user_id. Signed out it is simply null,
  // which is the public case and is expected.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_enquiry", {
    payload: {
      kind,
      name,
      email,
      phone,
      school,
      licences: (payload.licences ?? "").trim(),
      heard_about: (payload.heard_about ?? "").trim(),
      heard_other: (payload.heard_other ?? "").trim(),
      message: (payload.message ?? "").trim(),
    },
  });

  if (error) {
    // submit_enquiry() raises wording written to be read by the person who
    // typed the form, so it is passed through rather than rewritten.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Record the attempt only once it succeeded. A rejected submission should not
  // count against someone who mistyped their address and fixed it.
  if (ip !== "unknown") {
    await supabaseAdmin.from("enquiry_rate").insert({ ip });
    // Opportunistic prune. Cheap, indexed, and keeps a table nobody reads from
    // growing without bound. Failure here is irrelevant to the caller.
    await supabaseAdmin
      .from("enquiry_rate")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }

  return NextResponse.json({ ok: true, reference: data as string });
}

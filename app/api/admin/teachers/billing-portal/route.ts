import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { stripe } from "@/app/lib/stripe";

// Creates a Stripe Billing Portal link for a teacher so an admin can help them
// update a failing card.
//
// Returns the URL for the admin to copy rather than emailing it. A portal
// session URL is an unauthenticated bearer credential to someone's billing
// details — anyone holding the link is in. Emailing that to an address we
// haven't just re-verified is a decision that deserves its own review, so v1
// hands it to the admin, who can pass it on over a channel they trust.
export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("change_plan");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "This teacher has no Stripe customer — there's no card to update." },
      { status: 400 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/account/billing`,
    });
    await gate.supabase.rpc("admin_log_portal_link", { uid: userId });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[admin/billing-portal]", err);
    return NextResponse.json({ error: "Could not create a portal link." }, { status: 500 });
  }
}

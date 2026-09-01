import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { stripe, priceIdFor, isPaidPlanId } from "@/app/lib/stripe";

// Creates a Stripe Checkout Session for a paid plan and returns its URL. The
// browser redirects to it; payment success is confirmed asynchronously by the
// webhook, not here — never grant access from this route.
//
// There are two things to buy: Pro and Max, both monthly. The requested plan is
// checked against that allowlist rather than trusted, so a crafted body cannot
// name an arbitrary plan (or a price) and cannot reach `school`, which has no
// working billing. An absent or unrecognised plan falls back to Pro, keeping
// every existing caller — which sends no body at all — working unchanged.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Existing callers POST with no body at all, so an unparseable body is the
  // normal case, not an error.
  const body = await req.json().catch(() => null);
  const requested = (body as { plan?: unknown } | null)?.plan;
  const plan = isPaidPlanId(requested) ? requested : "pro";

  // Reuse the customer we already linked, so a returning subscriber doesn't get
  // a duplicate Stripe customer.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  try {
    // Resolved from plan_config (falling back to the env var), so a price
    // changed in the admin console takes effect on the next checkout without a
    // redeploy.
    const priceId = await priceIdFor(plan);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Lets the webhook tie the resulting subscription back to our user.
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id } },
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email }),
      success_url: `${origin}/account/billing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { stripe, topUpPriceId } from "@/app/lib/stripe";

// Creates a one-off Stripe Checkout Session for £1.50 of AI credit and returns
// its URL. Offered when a paid user hits their monthly spend ceiling.
//
// As with the subscription checkout, this route NEVER grants the credit — the
// webhook does, once Stripe confirms payment. Each session is independent, so
// a user may buy as many top-ups in a month as they like.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  try {
    // Resolved from the active credit pack (falling back to the env var).
    const priceId = await topUpPriceId();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      // `mode: "payment"` has no subscription_data, so the webhook identifies
      // the buyer from metadata instead. Stamped in both places: the session
      // (read on checkout.session.completed) and the PaymentIntent (so the
      // charge is still attributable if it's ever inspected on its own).
      metadata: { userId: user.id, kind: "credit_topup" },
      payment_intent_data: {
        metadata: { userId: user.id, kind: "credit_topup" },
      },
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email }),
      success_url: `${origin}/account/billing?topup=success`,
      cancel_url: `${origin}/account/billing?topup=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/topup]", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}

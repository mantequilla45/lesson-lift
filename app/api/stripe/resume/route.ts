import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { stripe } from "@/app/lib/stripe";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// Reverses a scheduled cancellation: clears cancel_at_period_end so the
// subscription renews as normal.
//
// WHY THIS IS AN API CALL AND NOT A PORTAL FLOW
// Stripe's hosted portal can only offer "renew" through its
// subscription_update feature, which is disabled in this account's portal
// configuration (and enabling it would also expose plan-switching UI we don't
// want). Clearing the flag directly is one call, needs no portal config, and
// keeps the same subscription and price rather than starting a new checkout.
//
// This route CANNOT change what the customer pays. It sets exactly one boolean
// on a subscription it has already verified belongs to the caller — no price,
// quantity or item is read from the request, which is the same reasoning
// behind the flow allowlist in ../portal/route.ts.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  // Ownership check: the subscription id comes from THIS user's profile row,
  // never from the request body, so a caller cannot resume someone else's
  // subscription.
  const subscriptionId = profile?.stripe_subscription_id;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "There's no subscription to renew." },
      { status: 400 },
    );
  }

  // Already fully ended — the period elapsed and Stripe closed it. There is
  // nothing to un-cancel; they need to subscribe again.
  if (profile.subscription_status === "canceled") {
    return NextResponse.json(
      { error: "This subscription has already ended. Please subscribe again." },
      { status: 400 },
    );
  }

  try {
    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    // Write through immediately rather than waiting for the
    // customer.subscription.updated webhook. The webhook is still the source of
    // truth and will re-apply the same value moments later, but the teacher is
    // about to be redirected back to a freshly rendered billing page and it
    // should not still say "Access ends on …".
    //
    // supabaseAdmin, not the user's client: profiles' billing columns are
    // locked down to the service role (see the lock_down_profile_self_update
    // migration) precisely so a teacher cannot grant themselves a plan.
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        subscription_status: sub.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      // Stripe is the system of record and the renewal DID take effect, so this
      // is not a failure from the teacher's point of view — the webhook will
      // reconcile the row. Log it and report success.
      console.error("[stripe/resume] profile write-through failed", error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[stripe/resume]", err);
    return NextResponse.json(
      { error: "Could not renew your subscription." },
      { status: 500 },
    );
  }
}

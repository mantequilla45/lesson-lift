import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/app/lib/auth/server";
import { stripe } from "@/app/lib/stripe";

// Opens the Stripe Billing Portal so a subscriber can update their card, view
// invoices, or cancel. Returns the portal URL for the browser to redirect to.
//
// Optionally takes a `flow` so a button can land the teacher DIRECTLY on the
// card form or the cancel confirmation rather than the portal's front door.
// "Update card" that drops you on a menu is a worse button than one that
// doesn't exist.

/**
 * Flows a client may ask for. This is an ALLOWLIST, and it is a security
 * boundary rather than tidiness: Stripe's flow_data.type also accepts
 * `subscription_update_confirm`, which carries an items/price array. Passing a
 * client-supplied string straight through would let the browser nominate which
 * price the customer is moved onto — i.e. choose what they pay.
 */
const ALLOWED_FLOWS = ["payment_method_update", "subscription_cancel"] as const;
type PortalFlow = (typeof ALLOWED_FLOWS)[number];

function asFlow(v: unknown): PortalFlow | null {
  return typeof v === "string" && (ALLOWED_FLOWS as readonly string[]).includes(v)
    ? (v as PortalFlow)
    : null;
}

export async function POST(req: NextRequest) {
  // The body is optional and MUST stay optional: the generic "Manage billing"
  // button posts with no body at all, and req.json() throws on empty input
  // rather than returning null. Swallowing that keeps the no-flow request
  // byte-identical to what it was before flows existed.
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requested = (body as { flow?: unknown })?.flow;
  const flow = asFlow(requested);

  // A flow we don't recognise is a client bug or an attempt at the price
  // parameter above — either way, say so rather than silently falling back to
  // the generic portal, which would look like the button worked.
  if (requested !== undefined && flow === null) {
    return NextResponse.json({ error: "Unsupported billing flow" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const returnUrl = `${origin}/account/billing`;

  // The two guards below mirror the conditions the Overview tab uses to decide
  // whether to render the Cancel button. Repeated here because a page left open
  // across a cancellation still has the button, and the resulting Stripe error
  // would be an opaque `resource_missing`.
  //
  // Note a customer can exist with NO subscription: buying a credit top-up
  // attaches a Stripe customer (see app/api/stripe/topup/route.ts), so a free
  // teacher who has ever topped up reaches this route legitimately and can
  // update their card — but has nothing to cancel.
  if (flow === "subscription_cancel") {
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: "There's no active subscription to cancel." },
        { status: 400 },
      );
    }
    if (profile.subscription_status === "canceled") {
      return NextResponse.json(
        { error: "This subscription is already cancelled." },
        { status: 400 },
      );
    }
  }

  // Built as a discriminated value rather than a mutated object so the no-flow
  // case omits flow_data ENTIRELY. Sending `flow_data: undefined` is not the
  // same request as sending no key, and the generic portal must not change.
  let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;

  if (flow === "payment_method_update") {
    flowData = {
      type: "payment_method_update",
      // Send them back to Overview once the card is saved. Without this they
      // land on the portal homepage, having to work out for themselves whether
      // it took.
      after_completion: {
        type: "redirect",
        redirect: { return_url: returnUrl },
      },
    };
  } else if (flow === "subscription_cancel") {
    flowData = {
      type: "subscription_cancel",
      // The id nests under the flow-specific key, not at the top level of
      // flow_data, and Stripe requires it: a customer may hold several
      // subscriptions and it will not guess which one to cancel.
      subscription_cancel: { subscription: profile.stripe_subscription_id! },
      after_completion: {
        type: "redirect",
        redirect: { return_url: returnUrl },
      },
    };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
      ...(flowData ? { flow_data: flowData } : {}),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // A flow can fail because the feature is switched OFF in the portal
    // configuration in the Stripe dashboard (Settings → Billing → Customer
    // portal), which is invisible from here and not something the teacher can
    // fix. Log the flow so that shows up in the logs as itself rather than as a
    // generic portal failure.
    console.error("[stripe/portal]", flow ?? "generic", err);
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, planForPriceId } from "@/app/lib/stripe";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { DEFAULT_PLAN } from "@/app/lib/plans";

// Stripe → app sync. This is the ONLY place a user's plan is upgraded/downgraded
// from payment state. It runs with the service-role key (no user session) and
// must verify the signature on the raw body, so the request is never trusted
// blindly. This route is exempted from auth in proxy.ts.

// Statuses that should grant the paid plan. Anything else (canceled, unpaid,
// incomplete_expired, past_due…) falls back to Free.
const ACTIVE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "active",
  "trialing",
]);

function periodEnd(sub: Stripe.Subscription): string | null {
  // `current_period_end` lives on the subscription in older API versions and on
  // each item in newer ones — check both.
  const unix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end ??
    null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/** Apply a subscription's current state to the owning profile. */
async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Resolve the profile: prefer the userId we stamped at checkout, else fall
  // back to the customer id we stored on a previous event.
  let userId = sub.metadata?.userId ?? null;
  if (!userId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) {
    console.warn("[stripe/webhook] no profile for customer", customerId);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id;
  const paidPlan = planForPriceId(priceId);
  const isActive = ACTIVE_STATUSES.has(sub.status);
  const plan = isActive && paidPlan ? paidPlan : DEFAULT_PLAN;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd(sub),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) console.error("[stripe/webhook] profile update failed", error);
}

// ── Invoice mirroring ────────────────────────────────────────────────────────
// Stripe remains the system of record for card payments; these rows are a local
// mirror so the admin console can list card charges and school BACS invoices in
// one place, and so a failed payment is visible without opening the Stripe
// dashboard. Nothing here grants or revokes access — only syncSubscription does
// that.

/** Stripe works in minor units (pence). Everything we store is major (pounds). */
function toMajor(minor: number | null | undefined): number {
  return (minor ?? 0) / 100;
}

/** Resolve the local profile id for a Stripe customer. */
async function userIdForCustomer(customer: string | null): Promise<string | null> {
  if (!customer) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customer)
    .maybeSingle();
  return data?.id ?? null;
}

/** Human-readable payment method, e.g. "Visa ••4242 · Pro monthly". */
function describeInvoice(inv: Stripe.Invoice): string {
  const line = inv.lines?.data?.[0];
  const desc = line?.description ?? null;
  const brandLast4 = (
    inv as unknown as {
      payment_method_details?: { card?: { brand?: string; last4?: string } };
    }
  ).payment_method_details?.card;

  const parts: string[] = [];
  if (brandLast4?.brand && brandLast4?.last4) {
    parts.push(`${brandLast4.brand} ••${brandLast4.last4}`);
  }
  if (desc) parts.push(desc);
  return parts.join(" · ") || "Card · Stripe";
}

/**
 * Upsert one Stripe invoice into our table, keyed on stripe_invoice_id so
 * webhook retries and out-of-order delivery converge rather than duplicate.
 */
async function syncInvoice(inv: Stripe.Invoice, status: string) {
  const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer?.id ?? null);
  const userId = await userIdForCustomer(customerId);

  // A charge with no local profile is almost certainly test noise or a customer
  // created outside the app. Log rather than inventing an orphan row.
  if (!userId) {
    console.warn("[stripe/webhook] no profile for invoice customer", customerId);
    return;
  }

  const chargeId =
    typeof (inv as unknown as { charge?: string | { id: string } }).charge === "string"
      ? ((inv as unknown as { charge: string }).charge)
      : ((inv as unknown as { charge?: { id: string } }).charge?.id ?? null);

  const { error } = await supabaseAdmin.from("invoices").upsert(
    {
      stripe_invoice_id: inv.id,
      reference: inv.number ?? inv.id ?? "—",
      user_id: userId,
      type: "card",
      amount_gbp: toMajor(inv.amount_due || inv.total),
      status,
      due_at: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      method: describeInvoice(inv),
      stripe_charge_id: chargeId,
      attempt_count: inv.attempt_count ?? 0,
      failure_reason:
        status === "failed"
          ? ((inv as unknown as { last_finalization_error?: { message?: string } })
              .last_finalization_error?.message ?? "Payment failed")
          : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_invoice_id" },
  );

  if (error) console.error("[stripe/webhook] invoice upsert failed", error);
}

/** Mark the originating invoice refunded when a charge is refunded. */
async function syncRefund(charge: Stripe.Charge) {
  if (!charge.refunded && (charge.amount_refunded ?? 0) === 0) return;

  const { error } = await supabaseAdmin
    .from("invoices")
    .update({
      status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_charge_id", charge.id);

  if (error) console.error("[stripe/webhook] refund sync failed", error);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id,
          );
          // Carry the userId from the session in case it wasn't on the sub.
          if (session.client_reference_id && !sub.metadata?.userId) {
            sub.metadata = { ...sub.metadata, userId: session.client_reference_id };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      // ── Invoice mirroring ──────────────────────────────────────────────
      // Access is never granted or revoked here — that stays with
      // syncSubscription above. These only keep the local invoice list and the
      // "failed payments" queue in step with Stripe.
      case "invoice.created":
      case "invoice.finalized": {
        await syncInvoice(event.data.object as Stripe.Invoice, "sent");
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        await syncInvoice(event.data.object as Stripe.Invoice, "paid");
        break;
      }
      case "invoice.payment_failed": {
        await syncInvoice(event.data.object as Stripe.Invoice, "failed");
        break;
      }
      case "invoice.voided": {
        await syncInvoice(event.data.object as Stripe.Invoice, "void");
        break;
      }
      case "charge.refunded": {
        await syncRefund(event.data.object as Stripe.Charge);
        break;
      }

      default:
        // Ignore the many event types we don't act on.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries — the handler is idempotent (it just writes
    // current state), so a retry is safe.
    console.error("[stripe/webhook] handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

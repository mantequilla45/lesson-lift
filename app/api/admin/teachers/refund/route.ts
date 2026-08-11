import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { stripe } from "@/app/lib/stripe";

// Refunds a charge for a teacher.
//
// Charges are read live from Stripe rather than from our `invoices` mirror:
// stripe_charge_id is only populated by the invoice.paid webhook path, and is
// currently null on every existing row, so a local lookup would show nothing
// refundable. Stripe is the source of truth for money regardless.
//
// The refund itself is NOT mirrored back into `invoices` here — the
// charge.refunded webhook already does that (syncRefund in
// app/api/stripe/webhook/route.ts). Writing it in both places would race.

async function customerIdFor(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.stripe_customer_id ?? null;
}

/** Refundable charges for the teacher, newest first. */
export async function GET(req: NextRequest) {
  const gate = await requireAdminRoute("issue_refunds");
  if (gate.error) return gate.error;

  const userId = req.nextUrl.searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const customer = await customerIdFor(userId);
  if (!customer) {
    return NextResponse.json({ charges: [] });
  }

  try {
    const charges = await stripe.charges.list({ customer, limit: 10 });
    return NextResponse.json({
      charges: charges.data
        .filter((c) => c.status === "succeeded" && c.amount > c.amount_refunded)
        .map((c) => ({
          id: c.id,
          amount: c.amount,
          amountRefunded: c.amount_refunded,
          currency: c.currency,
          created: c.created,
          description: c.description,
        })),
    });
  } catch (err) {
    console.error("[admin/refund] list", err);
    return NextResponse.json({ error: "Could not load charges from Stripe." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("issue_refunds");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const chargeId = typeof body?.chargeId === "string" ? body.chargeId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const amountPence =
    typeof body?.amountPence === "number" && Number.isFinite(body.amountPence)
      ? Math.round(body.amountPence)
      : null;

  if (!userId || !chargeId) {
    return NextResponse.json({ error: "userId and chargeId are required." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Please give a reason — it goes in the audit log." }, { status: 400 });
  }

  const customer = await customerIdFor(userId);
  if (!customer) {
    return NextResponse.json({ error: "This teacher has no Stripe customer." }, { status: 400 });
  }

  try {
    // Re-fetch and verify the charge belongs to THIS teacher. The client sends
    // both ids, but a crafted request could pair one teacher's id with another
    // customer's charge — never trust that pairing.
    const charge = await stripe.charges.retrieve(chargeId);
    const chargeCustomer =
      typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
    if (chargeCustomer !== customer) {
      return NextResponse.json(
        { error: "That charge doesn't belong to this teacher." },
        { status: 400 },
      );
    }
    if (charge.status !== "succeeded") {
      return NextResponse.json({ error: "That charge didn't succeed." }, { status: 400 });
    }

    const refundable = charge.amount - charge.amount_refunded;
    if (refundable <= 0) {
      return NextResponse.json({ error: "That charge is already fully refunded." }, { status: 400 });
    }
    const amount = amountPence ?? refundable;
    if (amount <= 0 || amount > refundable) {
      return NextResponse.json(
        { error: `Refund must be between 1p and ${refundable}p.` },
        { status: 400 },
      );
    }

    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount,
      reason: "requested_by_customer",
      metadata: { jooma_admin: gate.user.id, jooma_reason: reason },
    });

    await gate.supabase.rpc("admin_log_refund", {
      uid: userId,
      p_charge_id: chargeId,
      p_amount_pence: amount,
      p_reason: reason,
    });

    return NextResponse.json({ ok: true, refundId: refund.id, amount });
  } catch (err) {
    console.error("[admin/refund]", err);
    const msg = err instanceof Error ? err.message : "Could not issue the refund.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

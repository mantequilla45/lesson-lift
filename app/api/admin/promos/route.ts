import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { stripe } from "@/app/lib/stripe";

// Create and deactivate Stripe promotion codes from the admin console.
//
// Stripe remains the source of truth: it is the system that validates a code at
// checkout, so a code that existed only in our database would be rejected the
// moment a teacher typed it. Nothing is mirrored locally.
//
// WHAT CANNOT BE EDITED: a coupon's discount is immutable. Once BACKTOSCHOOL is
// 20% off, it is 20% off forever — Stripe offers no way to change it. Changing
// an offer means creating a new code and deactivating the old one, which is a
// deliberate decision (redemption history belongs to the code) and so is left to
// the admin rather than done silently. PATCH therefore only touches `active` and
// the campaign metadata.

/** A promotion code is one Coupon (the discount) + one Promotion Code (the
 *  string a teacher types). Creating a code always creates both. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("change_plan");
  if (gate.error) return gate.error;

  let body: {
    code?: string;
    percentOff?: number;
    amountOffGbp?: number;
    duration?: "once" | "repeating" | "forever";
    durationInMonths?: number;
    maxRedemptions?: number;
    expiresAt?: string;
    channel?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Stripe uppercases codes and matches case-insensitively at checkout.
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return NextResponse.json(
      { error: "Use 3–40 characters: letters, numbers, hyphens or underscores." },
      { status: 400 },
    );
  }

  const percentOff = body.percentOff != null ? Number(body.percentOff) : null;
  const amountOffGbp = body.amountOffGbp != null ? Number(body.amountOffGbp) : null;

  if ((percentOff == null) === (amountOffGbp == null)) {
    return NextResponse.json(
      { error: "Give either a percentage off or an amount off, not both." },
      { status: 400 },
    );
  }
  if (percentOff != null && (!(percentOff > 0) || percentOff > 100)) {
    return NextResponse.json(
      { error: "A percentage discount must be between 1 and 100." },
      { status: 400 },
    );
  }
  if (amountOffGbp != null && (!(amountOffGbp > 0) || amountOffGbp > 500)) {
    return NextResponse.json(
      { error: "An amount off must be between £0.01 and £500." },
      { status: 400 },
    );
  }

  const duration = body.duration ?? "once";
  if (!["once", "repeating", "forever"].includes(duration)) {
    return NextResponse.json({ error: "Unknown discount duration." }, { status: 400 });
  }
  if (duration === "repeating" && !(Number(body.durationInMonths) > 0)) {
    return NextResponse.json(
      { error: "A repeating discount needs a number of months." },
      { status: 400 },
    );
  }

  // Stripe expects a Unix timestamp; reject an expiry already in the past rather
  // than creating a code nobody can ever redeem.
  let expiresAt: number | undefined;
  if (body.expiresAt) {
    const parsed = Date.parse(body.expiresAt);
    if (Number.isNaN(parsed)) {
      return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
    }
    if (parsed <= Date.now()) {
      return NextResponse.json({ error: "That expiry date is in the past." }, { status: 400 });
    }
    expiresAt = Math.floor(parsed / 1000);
  }

  try {
    const coupon = await stripe.coupons.create({
      name: code,
      duration,
      ...(duration === "repeating"
        ? { duration_in_months: Number(body.durationInMonths) }
        : {}),
      ...(percentOff != null
        ? { percent_off: percentOff }
        : { amount_off: Math.round(Number(amountOffGbp) * 100), currency: "gbp" }),
    });

    const promotionCode = await stripe.promotionCodes.create({
      // On this API version the coupon is nested under `promotion` rather than
      // sitting on the promotion code directly — the same shape shift the read
      // path in app/admin/promos/page.tsx has to work around when expanding.
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      ...(body.maxRedemptions ? { max_redemptions: Number(body.maxRedemptions) } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      // Campaign attribution lives with the code, so it stays attached whether
      // it is read here or in the Stripe dashboard.
      ...(body.channel ? { metadata: { channel: String(body.channel).slice(0, 200) } } : {}),
    });

    await gate.supabase.rpc("admin_log", {
      p_action: `Created promo code ${code}`,
      p_action_type: "billing",
      p_object_type: "promo_code",
      p_object_id: promotionCode.id,
      p_object_label: code,
      p_detail: {
        coupon_id: coupon.id,
        percent_off: percentOff,
        amount_off_gbp: amountOffGbp,
        duration,
        channel: body.channel ?? null,
      },
    });

    return NextResponse.json({ id: promotionCode.id, code });
  } catch (err) {
    console.error("[admin/promos] create failed", err);
    // Stripe's own message is the useful one here ("code already exists", etc.).
    const message = err instanceof Error ? err.message : "Could not create the code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Activate/deactivate a code, or retag its channel. Stripe allows nothing else
 *  to change after creation. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdminRoute("change_plan");
  if (gate.error) return gate.error;

  let body: { id?: string; active?: boolean; channel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id.startsWith("promo_")) {
    return NextResponse.json({ error: "A promotion code id is required." }, { status: 400 });
  }

  try {
    const updated = await stripe.promotionCodes.update(id, {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(body.channel !== undefined
        ? { metadata: { channel: String(body.channel).slice(0, 200) } }
        : {}),
    });

    if (typeof body.active === "boolean") {
      await gate.supabase.rpc("admin_log", {
        p_action: `${body.active ? "Activated" : "Deactivated"} promo code ${updated.code}`,
        p_action_type: "billing",
        p_object_type: "promo_code",
        p_object_id: id,
        p_object_label: updated.code,
        p_detail: { active: body.active },
      });
    }

    return NextResponse.json({ id: updated.id, active: updated.active });
  } catch (err) {
    console.error("[admin/promos] update failed", err);
    const message = err instanceof Error ? err.message : "Could not update the code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

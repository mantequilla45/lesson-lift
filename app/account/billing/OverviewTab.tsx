import Link from "next/link";
import { createClient } from "@/app/lib/auth/server";
import { asPlanId, PLANS, PLAN_CREDITS } from "@/app/lib/plans";
import ManageButton from "./ManageButton";
import ResumeButton from "./ResumeButton";
import AllowanceMeter from "./AllowanceMeter";

// Overview: current plan, where they stand against this month's allowance, and
// the actions that change either. The proxy guarantees a session by the time
// this renders.
export default async function OverviewTab({
  checkout,
  topup,
}: {
  // Passed down from the page shell, which owns searchParams, rather than read
  // again here — one source, so the banner and the tab strip can't disagree.
  checkout?: string;
  topup?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: usedMonth }, { data: usedToday }, { data: spend }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "plan, subscription_status, cancel_at_period_end, current_period_end, stripe_customer_id, stripe_subscription_id",
        )
        .eq("id", user?.id ?? "")
        .maybeSingle(),
      supabase.rpc("my_generation_count_this_month"),
      supabase.rpc("my_generation_count_today"),
      supabase.rpc("monthly_ai_spend", { uid: user?.id ?? "" }),
    ]);

  // monthly_ai_spend returns one row; supabase-js hands back an array.
  const spendRow = (Array.isArray(spend) ? spend[0] : spend) as
    | { spend_pence: number | string; credit_pence: number | string }
    | null
    | undefined;

  const plan = asPlanId(profile?.plan);
  const planName = PLANS[plan].name;

  // Two different flags, deliberately not collapsed into one.
  //
  // A Stripe CUSTOMER can exist with no subscription: buying a credit top-up
  // attaches one (see app/api/stripe/topup/route.ts), so a free teacher who has
  // ever topped up has a card on file worth updating — but nothing to cancel.
  // Cancel additionally needs the subscription id because Stripe's
  // subscription_cancel flow takes it as a required parameter.
  const isSubscriber = Boolean(profile?.stripe_customer_id);
  const hasSubscription = Boolean(profile?.stripe_subscription_id);

  const renews = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  // Two distinct states, and the difference is the whole point of this block.
  //
  // ENDING: cancelled through the portal, which schedules rather than cancels —
  // Stripe keeps status = "active" and only sets cancel_at_period_end, so the
  // teacher keeps Pro until the period runs out. Testing the status alone (as
  // this once did) never matched, so the page claimed the plan would "renew"
  // and kept offering a Cancel button Stripe would reject.
  //
  // ENDED: the period elapsed and Stripe closed the subscription for good.
  // Nothing left to renew — resubscribing means a new checkout.
  const ended = profile?.subscription_status === "canceled";
  const ending = Boolean(profile?.cancel_at_period_end) && !ended;

  return (
    <div className="max-w-xl">
      {/* The plan is granted by the Stripe webhook, which lands a moment after
          this redirect — so `plan` here is usually still the OLD one. Naming
          it would congratulate the user on the plan they just paid to leave.
          Report only what we know: the payment went through. */}
      {checkout === "success" && plan === "free" && (
        <div
          className="rounded-xl px-4 py-3 mb-5 text-sm font-medium"
          style={{ backgroundColor: "#FDF0D5", color: "#8a6d1f" }}
        >
          Payment received — activating your plan. This usually takes a few
          seconds; refresh the page to check.
        </div>
      )}

      {checkout === "success" && plan !== "free" && (
        <div
          className="rounded-xl px-4 py-3 mb-5 text-sm font-medium"
          style={{ backgroundColor: "#DDF0E2", color: "#1f6b3b" }}
        >
          Payment received — welcome to {planName}!
        </div>
      )}

      {topup === "success" && (
        <div
          className="rounded-xl px-4 py-3 mb-5 text-sm font-medium"
          style={{ backgroundColor: "#DDF0E2", color: "#1f6b3b" }}
        >
          Payment received — {PLAN_CREDITS.toLocaleString("en-GB")} credits have been added
          to this month.
        </div>
      )}

      <div
        className="rounded-2xl p-6 border"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: "#8a8078" }}>
              Current plan
            </p>
            <p className="text-xl font-bold" style={{ color: "#1a1a1a" }}>
              {planName}
            </p>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: "#EEECE4", color: "#8a8078" }}
          >
            {profile?.subscription_status ?? (plan === "free" ? "free" : "—")}
          </span>
        </div>

        {renews && (
          <p className="text-sm mb-5" style={{ color: "#6b6055" }}>
            {ending || ended
              ? `Access ends on ${renews}.`
              : `Renews on ${renews}.`}
          </p>
        )}

        {isSubscriber ? (
          <div className="flex flex-wrap items-start gap-2">
            {/* No flow — lands on the portal homepage, which is also where
                Stripe keeps the downloadable invoice history. The History tab
                links here for exactly that reason. */}
            <ManageButton label="Manage billing" />
            <ManageButton
              flow="payment_method_update"
              label="Update card"
              variant="outline"
            />
            {/* Cancel and Renew are the same slot in two states, never both:
                offering Cancel on an already-cancelling subscription invites a
                second attempt that Stripe rejects, which is what this used to
                do. Once it has fully ended there is nothing to renew either —
                the "resubscribe" note below covers that case. */}
            {hasSubscription && !ending && !ended && (
              <ManageButton
                flow="subscription_cancel"
                label="Cancel subscription"
                variant="danger"
              />
            )}
            {hasSubscription && ending && <ResumeButton />}
          </div>
        ) : (
          <Link
            href="/pricing"
            className="inline-block py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E0463F", color: "#fff" }}
          >
            Upgrade to Pro
          </Link>
        )}

        {/* Two different messages, because the two states have different exits.
            While ENDING the subscription is still live and the Renew button
            above undoes it in place — telling them to visit /pricing would send
            them to buy a second subscription they don't need. Once ENDED, that
            really is the only route back. */}
        {ending && (
          <p className="text-sm mt-4" style={{ color: "#8a8078" }}>
            Your plan is set to end. Renew to keep it — you won&apos;t be charged
            until {renews ?? "the next billing date"}.
          </p>
        )}

        {ended && (
          <p className="text-sm mt-4" style={{ color: "#8a8078" }}>
            You can resubscribe any time from the pricing page.
          </p>
        )}
      </div>

      {/* The top-up button lives inside the meter, shown only above 80% used —
          see the reasoning there and the `hide_counter` pricing rule. */}
      <AllowanceMeter
        plan={plan}
        usedToday={typeof usedToday === "number" ? usedToday : 0}
        usedMonth={typeof usedMonth === "number" ? usedMonth : 0}
        spendPence={Number(spendRow?.spend_pence ?? 0)}
        creditPence={Number(spendRow?.credit_pence ?? 0)}
        justToppedUp={topup === "success"}
      />
    </div>
  );
}

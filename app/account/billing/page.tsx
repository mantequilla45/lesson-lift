import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/app/lib/auth/server";
import { asPlanId, PLANS, PLAN_CREDITS } from "@/app/lib/plans";
import ManageButton from "./ManageButton";
import AllowanceMeter from "./AllowanceMeter";

// Billing dashboard: shows the signed-in user's current plan, where they stand
// against this month's allowance, and (for paying subscribers) a button into the
// Stripe portal to update or cancel. The proxy guarantees a session by the time
// this renders.
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; topup?: string }>;
}) {
  const { checkout, topup } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: usedMonth }, { data: usedToday }, { data: spend }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("plan, subscription_status, current_period_end, stripe_customer_id")
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
  const isSubscriber = Boolean(profile?.stripe_customer_id);
  const renews = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const cancelling = profile?.subscription_status === "canceled";

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: "#F1EFE3" }}>
      <div className="max-w-xl mx-auto w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold mb-6 transition-colors hover:opacity-70"
          style={{ color: "#1a1a1a" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#1a1a1a" }}>
          Billing
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8a8078" }}>
          Manage your Jooma subscription.
        </p>

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
              {cancelling
                ? `Access ends on ${renews}.`
                : `Renews on ${renews}.`}
            </p>
          )}

          {isSubscriber ? (
            <ManageButton />
          ) : (
            <Link
              href="/pricing"
              className="inline-block py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#E0463F", color: "#fff" }}
            >
              Upgrade to Pro
            </Link>
          )}
        </div>

        <AllowanceMeter
          plan={plan}
          usedToday={typeof usedToday === "number" ? usedToday : 0}
          usedMonth={typeof usedMonth === "number" ? usedMonth : 0}
          spendPence={Number(spendRow?.spend_pence ?? 0)}
          creditPence={Number(spendRow?.credit_pence ?? 0)}
          justToppedUp={topup === "success"}
        />
      </div>
    </div>
  );
}

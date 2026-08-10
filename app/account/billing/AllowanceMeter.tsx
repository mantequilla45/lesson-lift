import { AI_SPEND_CEILING_PENCE, PLANS, type PlanId } from "@/app/lib/plans";
import TopUpButton from "./TopUpButton";

// Where a user stands this month. Two different shapes, because the two plans
// are metered on different things:
//
//   Free — a generation COUNT (1 a day, 5 a month, global across all tools).
//   Paid — measured AI SPEND against a monthly ceiling, plus any credit bought.
//
// Deliberately not shown in the app header: pricing_rules carries a
// `hide_counter` rule ("show it only above 80% used — a visible counter makes
// teachers generate less"), so the meter lives here and in the block modal.

const PROMINENT_AT = 0.8;

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** First of next month, in the user's locale — when everything resets. */
function resetsOn(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long" },
  );
}

function Bar({ fraction, tone }: { fraction: number; tone: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: "#EEECE4" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.min(100, Math.max(0, fraction * 100))}%`,
          backgroundColor: tone,
        }}
      />
    </div>
  );
}

export default function AllowanceMeter({
  plan,
  usedToday,
  usedMonth,
  spendPence,
  creditPence,
  justToppedUp,
}: {
  plan: PlanId;
  usedToday: number;
  usedMonth: number;
  spendPence: number;
  creditPence: number;
  /** True right after a top-up redirect, before the webhook has landed. */
  justToppedUp?: boolean;
}) {
  const ceiling = AI_SPEND_CEILING_PENCE[plan];

  // ── Paid plans: measured spend against the ceiling ──
  if (ceiling !== null) {
    const allowance = ceiling + creditPence;
    const fraction = allowance > 0 ? spendPence / allowance : 0;
    const spent = spendPence >= allowance;
    const tone = spent ? "#c2342b" : fraction >= PROMINENT_AT ? "#b07a1e" : "#3a8f5a";

    return (
      <div
        className="rounded-2xl p-6 border mt-5"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
      >
        <p className="text-xs font-semibold mb-1" style={{ color: "#8a8078" }}>
          AI allowance this month
        </p>
        <p className="text-xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          {gbp(spendPence)}{" "}
          <span className="text-sm font-medium" style={{ color: "#8a8078" }}>
            of {gbp(allowance)} used
          </span>
        </p>

        <Bar fraction={fraction} tone={tone} />

        {creditPence > 0 && (
          <p className="text-sm mb-1" style={{ color: "#6b6055" }}>
            Includes {gbp(creditPence)} of purchased credit.
          </p>
        )}

        <p className="text-sm" style={{ color: "#8a8078" }}>
          Resets on {resetsOn()}. Unused credit doesn&apos;t carry over.
        </p>

        {justToppedUp && creditPence === 0 && (
          <p className="text-sm mt-3" style={{ color: "#b07a1e" }}>
            Your credit is being applied — refresh in a moment.
          </p>
        )}

        {/* Offered early enough to be useful, not so early it nags. */}
        {(spent || fraction >= PROMINENT_AT) && (
          <div className="mt-4">
            <TopUpButton />
          </div>
        )}
      </div>
    );
  }

  // ── Free: generation counts ──
  const { dailyGenerations, monthlyGenerations } = PLANS[plan].limits;
  if (dailyGenerations === null && monthlyGenerations === null) return null;

  const monthFraction =
    monthlyGenerations !== null ? usedMonth / monthlyGenerations : 0;
  const outOfMonth = monthlyGenerations !== null && usedMonth >= monthlyGenerations;
  const outOfDay = dailyGenerations !== null && usedToday >= dailyGenerations;

  return (
    <div
      className="rounded-2xl p-6 border mt-5"
      style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
    >
      <p className="text-xs font-semibold mb-1" style={{ color: "#8a8078" }}>
        Generations
      </p>
      <p className="text-xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
        {usedMonth}{" "}
        <span className="text-sm font-medium" style={{ color: "#8a8078" }}>
          of {monthlyGenerations} this month
        </span>
      </p>

      <Bar
        fraction={monthFraction}
        tone={outOfMonth ? "#c2342b" : monthFraction >= PROMINENT_AT ? "#b07a1e" : "#3a8f5a"}
      />

      {dailyGenerations !== null && (
        <p className="text-sm mb-1" style={{ color: "#6b6055" }}>
          {outOfDay
            ? "You've used today's generation — the next unlocks at midnight UTC."
            : `${usedToday} of ${dailyGenerations} used today.`}
        </p>
      )}

      <p className="text-sm" style={{ color: "#8a8078" }}>
        {outOfMonth
          ? `Your free generations reset on ${resetsOn()}.`
          : `Resets on ${resetsOn()}.`}
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { FX_USD_TO_GBP, gbp, gbpFromUsd, nf, penceFromUsd } from "./format";
import {
  C,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Note,
  PageHead,
  Stat,
  Tag,
} from "./ui";

export interface DashboardStats {
  total_teachers: number;
  new_teachers_month: number;
  paying_teachers: number;
  mrr_gbp: number;
  b2c_mrr_gbp: number;
  b2b_mrr_gbp: number;
  /** Given away by an admin: on a paid plan with no Stripe subscription. */
  comped_mrr_gbp: number;
  comped_teachers: number;
  /** Paying now, but set to cancel at the end of the period. */
  ending_mrr_gbp: number;
  ending_teachers: number;
  schools_total: number;
  schools_live: number;
  seats_sold: number;
  seats_assigned: number;
  cost_month_usd: number;
  ai_image_cost_usd: number;
  generations_month: number;
  ai_images_month: number;
  open_tickets: number;
  high_priority_tickets: number;
  flags_awaiting: number;
  overdue_invoices: number;
  overdue_value_gbp: number;
  failed_payments: number;
}

export interface NeedsAttentionRow {
  kind: string;
  title: string;
  detail: string;
  href: string;
  severity: string;
}

export interface SignupRow {
  month_start: string;
  label: string;
  signups: number;
}

export interface CostRow {
  label: string;
  cost_usd: number;
  units: number;
  note: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  high: C.danger,
  normal: C.warn,
  low: C.muted,
};

export interface TrueMrr {
  gbp: number | null;
  counted: number;
  skipped: number;
  error: string | null;
}

export default function DashboardView({
  stats,
  attention,
  signups,
  costs,
  trueMrr,
}: {
  stats: DashboardStats | null;
  attention: NeedsAttentionRow[];
  signups: SignupRow[];
  costs: CostRow[];
  trueMrr?: TrueMrr;
}) {
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const totalTeachers = Number(stats?.total_teachers ?? 0);
  const paying = Number(stats?.paying_teachers ?? 0);
  const listMrr = Number(stats?.mrr_gbp ?? 0);
  const comped = Number(stats?.comped_mrr_gbp ?? 0);
  const compedCount = Number(stats?.comped_teachers ?? 0);
  const ending = Number(stats?.ending_mrr_gbp ?? 0);
  const endingCount = Number(stats?.ending_teachers ?? 0);

  /*
   * Two figures, and which one leads matters.
   *
   * The SQL figure can only ever be LIST price: nothing in our database records
   * what a subscription is actually charged, and promotion codes are allowed at
   * checkout. Where Stripe answered, its total is the honest one and leads.
   * Where it did not, the list figure is shown and labelled as such rather than
   * presented as exact.
   *
   * The B2B half is not in the Stripe figure — school seats are invoiced, not
   * subscribed — so it is added back on.
   *
   * Both figures now cover the same teachers: the live total is taken over the
   * subscription ids teacher_mrr() counted, not over every active subscription
   * on the Stripe account. Summing the account showed GBP 46.95 next to "1
   * paying teacher", because staff subscriptions, a cancelling one, an orphan
   * and a teacher's second subscription were all in it.
   */
  const b2b = Number(stats?.b2b_mrr_gbp ?? 0);
  const billed = trueMrr?.gbp ?? null;
  const mrr = billed === null ? listMrr : billed + b2b;
  const usingStripe = billed !== null;

  // A subscription the database names but Stripe would not price: gone, no
  // longer active, or not in GBP. Worth saying, because it is silently missing
  // from the total otherwise.
  const unpriced = trueMrr?.skipped ?? 0;
  const costUsd = Number(stats?.cost_month_usd ?? 0);
  const aiImageCost = Number(stats?.ai_image_cost_usd ?? 0);
  const gens = Number(stats?.generations_month ?? 0);
  const seatsSold = Number(stats?.seats_sold ?? 0);
  const seatsAssigned = Number(stats?.seats_assigned ?? 0);

  // Gross margin on subscription revenue, after measured AI cost only. Card
  // fees and overheads are excluded — this is the AI-cost lever, not a P&L.
  // The shared constant rather than a second copy of the literal, which is how
  // this drifted from the rate the rest of the console uses. The rate itself
  // belongs in the fx_rate table; see the note in format.ts.
  const costGbp = costUsd * FX_USD_TO_GBP;
  const grossMargin = mrr > 0 ? (mrr - costGbp) / mrr : null;
  const conversion = totalTeachers > 0 ? (paying / totalTeachers) * 100 : 0;
  const aiShare = costUsd > 0 ? (aiImageCost / costUsd) * 100 : 0;

  const maxSignups = Math.max(1, ...signups.map((s) => Number(s.signups)));
  const totalCost = costs.reduce((a, c) => a + Number(c.cost_usd), 0);

  return (
    <>
      <PageHead title="Dashboard" sub={`Everything at a glance — ${month}.`} />

      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Teachers"
          value={nf.format(totalTeachers)}
          delta={
            Number(stats?.new_teachers_month ?? 0) > 0
              ? `+${nf.format(Number(stats?.new_teachers_month))}`
              : undefined
          }
          dir="up"
          foot="this month"
        />
        <Stat
          label="Paying teachers"
          value={nf.format(paying)}
          foot={totalTeachers > 0 ? `${conversion.toFixed(1)}% of all teachers` : "—"}
        />
        <Stat
          label="MRR"
          value={gbp(mrr)}
          foot={
            usingStripe
              ? `Actually billed · B2B ${gbp(b2b)}` +
                (unpriced > 0 ? ` · ${nf.format(unpriced)} not priced` : "")
              : `List price${trueMrr ? ", Stripe unavailable" : ""} · B2B ${gbp(b2b)}`
          }
        />
        {/* Not folded into MRR, and not hidden either. A comp is revenue being
            given away and a cancellation is revenue leaving; both are worth
            seeing next to the number they used to silently inflate. */}
        <Stat
          label="Comped"
          value={gbp(comped)}
          foot={
            compedCount === 0
              ? "nobody on a free upgrade"
              : `${nf.format(compedCount)} ${compedCount === 1 ? "teacher" : "teachers"} at list price`
          }
        />
        <Stat
          label="Cancelling"
          value={gbp(ending)}
          foot={
            endingCount === 0
              ? "nobody has cancelled"
              : `${nf.format(endingCount)} ${endingCount === 1 ? "teacher" : "teachers"} leaving at period end`
          }
        />
        <Stat
          label="Gross margin"
          value={grossMargin === null ? "—" : `${(grossMargin * 100).toFixed(1)}%`}
          foot={grossMargin === null ? "no revenue yet" : "after measured AI cost"}
        />
      </div>

      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4 mt-3.5">
        <Stat
          label="AI cost this month"
          value={gbpFromUsd(costUsd)}
          foot={
            costUsd > 0
              ? `${gbpFromUsd(aiImageCost)} of it is images (${aiShare.toFixed(0)}%)`
              : "nothing generated yet"
          }
        />
        <Stat
          label="Generations"
          value={nf.format(gens)}
          foot={
            gens > 0
              ? `${penceFromUsd(costUsd / gens)} average`
              : "this month"
          }
        />
        <Stat
          label="Seats sold"
          value={nf.format(seatsSold)}
          foot={
            seatsSold > 0
              ? `${nf.format(seatsAssigned)} assigned · ${nf.format(seatsSold - seatsAssigned)} idle`
              : "no schools yet"
          }
        />
        <Stat
          label="Open tickets"
          value={nf.format(Number(stats?.open_tickets ?? 0))}
          foot={
            Number(stats?.high_priority_tickets ?? 0) > 0
              ? `${nf.format(Number(stats?.high_priority_tickets))} high priority`
              : "nothing urgent"
          }
        />
      </div>

      <div className="grid gap-3.5 mt-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px" }}>
        <Card>
          <CardHeader>
            <CardTitle>Signups by month</CardTitle>
          </CardHeader>
          <CardBody>
            {signups.length === 0 ? (
              <EmptyState title="No signup data" />
            ) : (
              <>
                <div className="flex items-end gap-1.5 h-32">
                  {signups.map((s) => {
                    const n = Number(s.signups);
                    return (
                      <div key={s.month_start} className="flex-1 flex flex-col justify-end h-full">
                        <div
                          className="rounded-t"
                          style={{
                            height: `${(n / maxSignups) * 100}%`,
                            minHeight: n > 0 ? 4 : 1,
                            backgroundColor: n > 0 ? C.ink : C.divider,
                          }}
                          title={`${s.label}: ${n}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {signups.map((s) => (
                    <div
                      key={s.month_start}
                      className="flex-1 text-center text-[11px] font-mono"
                      style={{ color: C.muted }}
                    >
                      {s.label}
                      <div className="tabular-nums" style={{ color: C.ink2 }}>
                        {nf.format(Number(s.signups))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
          <CardFooter>
            Signup source isn&apos;t recorded yet — nothing stores a UTM at signup, so
            acquisition channel and cost per signup can&apos;t be reported here.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs you today</CardTitle>
            {attention.length > 0 && <Tag tone="warn">{attention.length}</Tag>}
          </CardHeader>
          <CardBody>
            {attention.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm font-semibold" style={{ color: C.ok }}>
                  Nothing needs attention
                </p>
                <p className="text-xs mt-1" style={{ color: C.muted }}>
                  No overdue invoices, unanswered tickets, flags or idle schools.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {attention.map((a, i) => (
                  <div key={`${a.kind}-${i}`} className="flex gap-2.5 items-start">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: SEVERITY_COLOR[a.severity] ?? C.muted }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: C.ink }}>
                        {a.title}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: C.ink2 }}>
                        {a.detail}
                      </div>
                      <Link
                        href={a.href}
                        className="text-xs font-semibold hover:underline inline-block mt-1"
                        style={{ color: C.ink }}
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3.5 mt-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s eating the margin</CardTitle>
            <Link href="/admin/usage" className="text-xs font-semibold" style={{ color: C.ink }}>
              Full breakdown →
            </Link>
          </CardHeader>
          <CardBody>
            {totalCost === 0 ? (
              <EmptyState title="No cost recorded this month" />
            ) : (
              costs.map((c) => {
                const cost = Number(c.cost_usd);
                const share = (cost / totalCost) * 100;
                const isImages = c.label.includes("image");
                return (
                  <div key={c.label} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium flex-1" style={{ color: C.ink }}>
                        {c.label}
                      </span>
                      <span className="text-sm tabular-nums" style={{ color: C.ink }}>
                        {gbpFromUsd(cost)}
                      </span>
                      <span
                        className="text-xs tabular-nums w-10 text-right"
                        style={{ color: C.muted }}
                      >
                        {share.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded" style={{ backgroundColor: C.divider }}>
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${share}%`,
                          backgroundColor: isImages ? C.img : C.ai,
                        }}
                      />
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.muted }}>
                      {nf.format(Number(c.units))} units · {c.note}
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-sm space-y-2">
              {[
                ["Subscription MRR", gbp(mrr)],
                ["Schools live", nf.format(Number(stats?.schools_live ?? 0))],
                [
                  "Overdue invoices",
                  Number(stats?.overdue_invoices ?? 0) > 0
                    ? `${nf.format(Number(stats?.overdue_invoices))} · ${gbp(Number(stats?.overdue_value_gbp ?? 0))}`
                    : "None",
                ],
                [
                  "Failed payments",
                  Number(stats?.failed_payments ?? 0) > 0
                    ? nf.format(Number(stats?.failed_payments))
                    : "None",
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span style={{ color: C.muted }}>{k}</span>
                  <span className="tabular-nums" style={{ color: C.ink }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {aiShare > 50 && (
              <div className="mt-3">
                <Note tone="warn">
                  AI images are <b>{aiShare.toFixed(0)}% of AI cost</b> from{" "}
                  {nf.format(Number(stats?.ai_images_month ?? 0))} images. Each costs roughly
                  33× a text generation — the fastest way to move gross margin is fewer images
                  per deck.
                </Note>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

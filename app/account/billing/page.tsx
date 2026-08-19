import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Tabs from "./Tabs";
// asTab/TABS come from a plain module, not from Tabs.tsx: a "use client" file's
// non-component exports arrive here as client-reference stubs rather than real
// values, so calling TABS.some() on one throws at runtime.
import { asTab } from "./tabs-shared";
import { TabSkeleton } from "./Skeletons";
import OverviewTab from "./OverviewTab";
import UsageTab from "./UsageTab";
import HistoryTab from "./HistoryTab";

// Usage & Billing — where a teacher stands this month, what they've paid, and
// how to change either.
//
// The URL stays /account/billing rather than moving to something that reads
// like the heading, because it is hardcoded as a Stripe redirect target in four
// places (checkout, top-up, portal, and the admin-initiated portal link) plus
// very likely in the Stripe dashboard's own portal configuration, which we
// can't see from here. /account/usage was merged in and redirects; it had one
// in-app referrer, so it was the cheap side to move.
//
// This shell fetches NOTHING. Each tab body is its own async server component
// behind a Suspense boundary, so the heading, tab strip and banners paint
// immediately and only the tab you asked for does any work. The previous
// version awaited a four-way Promise.all before rendering a single pixel.
export const dynamic = "force-dynamic";

export default async function UsageBillingPage({
  searchParams,
}: {
  // A Promise in this version of Next — see
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
  searchParams: Promise<{ tab?: string; checkout?: string; topup?: string }>;
}) {
  const { tab: rawTab, checkout, topup } = await searchParams;
  const tab = asTab(rawTab);

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: "#F1EFE3" }}>
      <div className="max-w-5xl mx-auto w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold mb-6 transition-colors hover:opacity-70"
          style={{ color: "#1a1a1a" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#1a1a1a" }}>
          Usage &amp; Billing
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8a8078" }}>
          Your plan, your credits, and everything you&apos;ve paid for.
        </p>

        <Tabs active={tab} />

        {/*
          key={tab} is the single most important line on this page.

          All three tabs render into the SAME position in the tree, so once one
          has resolved React will happily reuse that boundary for the next one —
          leaving the PREVIOUS tab's content on screen until the new data
          arrives. Changing the key forces a brand-new boundary, so the skeleton
          shows immediately on every tab change.

          See docs/instant-navigation-guide.md §11.
        */}
        <Suspense key={tab} fallback={<TabSkeleton tab={tab} />}>
          {tab === "overview" && <OverviewTab checkout={checkout} topup={topup} />}
          {tab === "usage" && <UsageTab />}
          {tab === "history" && <HistoryTab />}
        </Suspense>
      </div>
    </div>
  );
}

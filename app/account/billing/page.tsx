import { redirect } from "next/navigation";

// Usage & Billing moved into /profile as its "Subscription" section.
//
// This URL stays alive as a redirect rather than being deleted, because it is
// not just an in-app link. It is hardcoded as a Stripe return target in four
// places — app/api/stripe/{checkout,topup,portal}/route.ts and the admin
// billing-portal route — and very likely in the Stripe dashboard's own customer
// portal configuration, which we can't see or change from here. A teacher coming
// back from a checkout would land on a 404.
//
// ALL search params are forwarded, not just recognised ones. ?checkout=success
// and ?topup=success are what OverviewTab renders its confirmation banner from,
// so dropping them would silently turn a successful payment into a blank page.
//
// The tab components themselves stay in this folder — they are still about
// billing, and /profile imports them from here.
//
// A server-component redirect() rather than a next.config.ts entry: config
// redirects are resolved before render and break the client-side transition for
// in-app links, which is the thing docs/instant-navigation-guide.md is about.
// redirect() also defaults to `replace` outside Server Actions, so the dead URL
// doesn't linger in the back-button history.
export default async function BillingRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const forwarded = new URLSearchParams();
  forwarded.set("section", "subscription");

  for (const [key, value] of Object.entries(params)) {
    // `section` is ours to set; anything else the caller sent rides along.
    if (key === "section" || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => forwarded.append(key, v));
    else forwarded.set(key, value);
  }

  redirect(`/profile?${forwarded.toString()}`);
}

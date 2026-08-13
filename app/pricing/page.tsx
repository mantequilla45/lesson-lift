// Server wrapper. Exists only to read editable copy — app/lib/copy.ts is
// server-only, and PricingView needs useRouter/useState for the Stripe checkout
// handoff, so the two cannot be the same component.
//
// Deliberately no `export const dynamic = "force-dynamic"`: the copy read is
// cached and tag-busted on publish, so this page stays statically renderable.
import { getCopy } from "@/app/lib/copy";
import PricingView from "./PricingView";

export default async function PricingPage() {
  const copy = await getCopy();
  return <PricingView copy={copy} />;
}

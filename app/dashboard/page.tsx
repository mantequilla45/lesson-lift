// Server wrapper. The dashboard fetches its runs in the browser and needs
// useState/useEffect, so it stays a client component; this exists purely to
// read the editable empty-state wording, which app/lib/copy.ts will only serve
// to the server.
import { getCopy } from "@/app/lib/copy";
import DashboardView from "./DashboardView";

export default async function DashboardPage() {
  const copy = await getCopy();
  return <DashboardView copy={copy} />;
}

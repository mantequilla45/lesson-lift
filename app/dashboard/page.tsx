// Server wrapper. Today fetches its runs in the browser and needs
// useState/useEffect, so it stays a client component; this exists purely to
// read the editable empty-state wording, which app/lib/copy.ts will only serve
// to the server.
import { getCopy } from "@/app/lib/copy";
import TodayView from "./TodayView";

export default async function DashboardPage() {
  const copy = await getCopy();
  return <TodayView copy={copy} />;
}

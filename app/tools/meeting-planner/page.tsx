import { CalendarDays } from "lucide-react";
import MeetingPlannerForm from "@/app/components/forms/MeetingPlannerForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function MeetingPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <MeetingPlannerForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<CalendarDays className="w-5 h-5 text-rose-600" />}

          title="Meeting Planner"
          description="This tool will help you to plan a meeting with a theme of your choice. Simply identify the purpose, attendees, duration, and any topics to cover, and the AI will make a plan."
          steps={[
            { label: "Enter meeting details", detail: "Specify the focus, attendees, and duration. Be as specific as possible." },
            { label: "Add topics to cover", detail: "List the key agenda items or discussion points you want to include.", optional: true },
            { label: "Generate", detail: "Get a structured meeting plan with a facilitation guide, timed agenda, and optional action items." },
          ]}
        />
      }
    />
  );
}

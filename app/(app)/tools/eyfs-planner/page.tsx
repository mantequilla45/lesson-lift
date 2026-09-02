import { Baby } from "lucide-react";
import EYFSPlannerForm from "@/app/components/forms/EYFSPlannerForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function EYFSPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <EYFSPlannerForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<Baby className="w-5 h-5 text-emerald-600" />}

          title="EYFS Planner"
          description="This tool identifies the areas of learning from your Early Years curriculum and plans activities for each of these areas based on a topic. It covers all 7 EYFS learning areas with child-led and adult-led activities, including indoor and outdoor provision."
          steps={[
            { label: "Enter your topic", detail: "Be specific when entering your topic for the most relevant and tailored activities." },
            { label: "Add options", detail: "Read the examples in the inputs to ensure you're entering information in the correct format." },
            { label: "Generate", detail: "Create plans with activities for all 7 EYFS learning areas, plus book lists, home learning, and a weekly overview." },
          ]}
        />
      }
    />
  );
}

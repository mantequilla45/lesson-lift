import { Target } from "lucide-react";
import PerformanceManagementForm from "@/app/components/forms/PerformanceManagementForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function PerformanceManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <PerformanceManagementForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<Target className="w-5 h-5 text-rose-600" />}

          title="Performance Management Targets"
          description="This tool can be used to draft performance management targets for staff. Simply provide the school type, staff role, pay scale, and responsibilities and summary of targets."
          steps={[
            { label: "Enter staff details", detail: "Include the school type, staff role, and pay scale." },
            { label: "Describe responsibilities and targets", detail: "Be specific when entering responsibilities and targets." },
            { label: "Generate", detail: "Get SMART performance management targets with success criteria, evidence, actions, and review points." },
          ]}
        />
      }
    />
  );
}

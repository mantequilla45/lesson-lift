import { FileText } from "lucide-react";
import ReportWriterForm from "@/app/components/forms/ReportWriterForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function ReportWriterPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <ReportWriterForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<FileText className="w-5 h-5 text-violet-600" />}

          title="Report Writer"
          description="This tool can be used to help write pupil reports. Simply fill out the details required, being careful not to include sensitive information. You can add up to 10 additional subjects or focuses by clicking 'Add another subject'."
          steps={[
            { label: "Enter pupil details", detail: "Be specific with strengths and areas for development for more personalised reports." },
            { label: "Add subjects", detail: "Add up to 10 subjects or focuses using 'Add another subject'." },
            { label: "Generate", detail: "Ideal for annual or mid-year reports. Do not include personally identifiable information." },
          ]}
        />
      }
    />
  );
}

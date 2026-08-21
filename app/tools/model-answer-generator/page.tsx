import { ClipboardCheck } from "lucide-react";
import ModelAnswerForm from "@/app/components/forms/ModelAnswerForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function ModelAnswerGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <ModelAnswerForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<ClipboardCheck className="w-5 h-5 text-violet-600" />}
          heroBg="bg-violet-50"
          title="Model Answer Generator"
          description="This tool can be used to generate model answers for exam-style questions worth varying marks. Simply enter the question and the total marks, and the AI will generate the response."
          steps={[
            { label: "Enter the exam question", detail: "Be specific when entering the exam question to answer." },
            { label: "Add optional context", detail: "Include mark scheme guidance or subject-specific criteria if available.", optional: true },
            { label: "Generate", detail: "Get a mark-appropriate model answer with teacher notes and assessment criteria." },
          ]}
        />
      }
    />
  );
}

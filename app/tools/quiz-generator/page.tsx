import { CircleHelp } from "lucide-react";
import QuizGeneratorForm from "@/app/components/forms/QuizGeneratorForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function QuizGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <QuizGeneratorForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<CircleHelp className="w-5 h-5 text-violet-600" />}
          heroBg="bg-violet-50"
          title="Quiz Generator"
          description="This quiz generator can be used to generate a multiple choice quiz on any given topic. Once generated, the quiz is fully editable and you can choose to export to popular quiz platforms."
          steps={[
            { label: "Enter your topic", detail: "Be specific when entering the topic for the quiz." },
            { label: "Generate and edit", detail: "Review and adjust the questions and answers to your needs." },
            { label: "Export", detail: "Export to Kahoot, Blooket, Gimkit, and more for retrieval or consolidation activities." },
          ]}
        />
      }
    />
  );
}

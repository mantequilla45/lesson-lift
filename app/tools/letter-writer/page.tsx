import { Mail } from "lucide-react";
import LetterWriterForm from "@/app/components/forms/LetterWriterForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

// searchParams are read here rather than with useSearchParams() in the form:
// that hook forces a client-side bailout needing a Suspense boundary around the
// whole form. Same approach as app/help/page.tsx.
export default async function LetterWriterPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; prefill?: string }>;
}) {
  const launch = await searchParams;
  return (
    <LetterWriterForm
      launch={launch}
      sidebar={
        <ToolInfoPanel
          icon={<Mail className="w-5 h-5 text-rose-600" />}
          heroBg="bg-rose-50"
          title="Letter Writer"
          description="This tool can be used to write letters to parents, or other recipients. Simply indicate who the letter is to, provide a brief summary of content and required tone. The AI will then draft the letter for you."
          steps={[
            { label: "Specify the recipient and tone", detail: "Indicate who the letter is to and the tone you need." },
            { label: "Provide content details", detail: "Provide as much information as possible for the letter." },
            { label: "Generate", detail: "Get a drafted letter for school events, trips, or general information sharing." },
          ]}
        />
      }
    />
  );
}

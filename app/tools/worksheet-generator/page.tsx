import { FileText } from "lucide-react";
import WorksheetGeneratorForm from "@/app/components/WorksheetGeneratorForm";
import ToolInfoPanel from "@/app/components/ToolInfoPanel";

export default function WorksheetGeneratorPage() {
  return (
    <WorksheetGeneratorForm
      sidebar={
        <ToolInfoPanel
          icon={<FileText className="w-5 h-5 text-violet-600" />}
          heroBg="bg-violet-50"
          title="Worksheet Generator"
          description="This tool can be used to create worksheets. Simply enter the year group, subject and learning objective you are targeting (remember to be specific) and hit generate."
          steps={[
            { label: "Enter key details", detail: "Read the examples in the inputs to ensure you're entering information in the correct format." },
            { label: "Be specific", detail: "It's important to be specific when entering the learning objective." },
            { label: "Generate", detail: "Whatever you need a worksheet on, this is the tool for you." },
          ]}
        />
      }
    />
  );
}

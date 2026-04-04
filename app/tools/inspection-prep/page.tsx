import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";
import InspectionPrepForm from "@/app/components/InspectionPrepForm";

function Sidebar() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-1.5">Inspection Prep Questions</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Use this tool to begin preparation for an inspection or accreditation with a body of
          your choice. If there is a focus area, enter this, and select any additional elements
          you wish to include.
        </p>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
          <ol className="space-y-3">
            {[
              "Read the examples in the inputs to ensure you're entering information in the correct format.",
              "It is important to be specific with the inspectorate/accrediting body and any focus area (if relevant).",
              "Ideas for use: generating questions to help you prepare at any stage of the process, supporting you with evidence ideas and success criteria.",
            ].map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {tip}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to all tools
      </Link>
    </div>
  );
}

export default function InspectionPrepPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <InspectionPrepForm sidebar={<Sidebar />} />
    </main>
  );
}

import Link from "next/link";
import { FileEdit, ArrowLeft } from "lucide-react";
import ECTReportWriterForm from "@/app/components/ECTReportWriterForm";

function Sidebar() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <FileEdit className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-1.5">ECT Report Writer</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This tool can be used to draft evidence for ECT reports. Simply enter a list of the
          teacher's strengths and areas for development, and the AI will turn these into
          paragraphs of evidence making links to the Teacher Standards where appropriate.
        </p>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
          <ol className="space-y-3">
            {[
              "It's important to be specific when entering the strengths and areas for development; the more information you add, the more detailed and accurate the AI's response.",
              "Ideas for use: drafting ECT report statements aligned to Teacher Standards.",
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

export default function ECTReportWriterPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <ECTReportWriterForm sidebar={<Sidebar />} />
    </main>
  );
}

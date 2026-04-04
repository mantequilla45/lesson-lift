import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReportWriterForm from "@/app/components/ReportWriterForm";

function Sidebar() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-1.5">Report Writer</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This tool can be used to help write pupil reports. Simply fill out the details required,
          being careful not to include sensitive information. You can add up to 10 additional
          subjects or focuses by clicking &lsquo;Add another subject&rsquo;.
        </p>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
          <ol className="space-y-3">
            {[
              "Read the examples in the inputs to ensure you're entering information in the correct format.",
              "Being more specific with the strengths and areas for development will create more personalised reports.",
              "Ideas for use: writing annual or mid-year reports.",
              "Please remember, in adherence to GDPR guidelines, it's crucial to refrain from including personally identifiable information or sensitive data about students within this report writer tool.",
            ].map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Link
        href="/"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all tools
      </Link>
    </div>
  );
}

export default function ReportWriterPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <ReportWriterForm sidebar={<Sidebar />} />
    </main>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SmartTargetsForm from "@/app/components/SmartTargetsForm";

function Sidebar() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-1.5">SMART Targets</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This tool can be used to draft SMART targets for students. Simply provide the year group
          and the overall targets and let the AI draft the targets for you. Remember to review and
          adapt the output so it is fully applicable to your student.
        </p>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
          <ol className="space-y-3">
            {[
              "Be as specific as possible when entering your targets — the more detail you provide, the more tailored the output will be.",
              "Ideas for use: create targets for students to plug gaps in their learning, or for intervention groups.",
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

export default function SmartTargetsPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <SmartTargetsForm sidebar={<Sidebar />} />
    </main>
  );
}

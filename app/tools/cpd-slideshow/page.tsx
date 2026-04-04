import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CpdSlideshowForm from "@/app/components/CpdSlideshowForm";

function Sidebar() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-1.5">CPD Slideshow Generator</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This tool will create presentations for teacher professional development sessions.
          Simply enter the topic and number of slides and let the AI draft the content. You can
          also select whether the slides focus on practical application or research and theory.
        </p>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
          <ol className="space-y-3">
            {[
              "Be specific when entering the topic — a detailed title will produce more tailored slide content.",
              "Use the additional focus areas field to steer the content towards specific themes or goals for your session.",
              "Ideas for use: create training resources for staff CPD sessions focusing on practical application or theory and research around a topic.",
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

export default function CpdSlideshowPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <CpdSlideshowForm sidebar={<Sidebar />} />
    </main>
  );
}

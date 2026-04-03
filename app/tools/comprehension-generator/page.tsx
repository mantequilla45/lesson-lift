import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";
import ComprehensionForm from "@/app/components/ComprehensionForm";

function Sidebar() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-1.5">Comprehension Generator</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This tool can be used to create reading comprehension activities. Select your curriculum,
          year group, text source and reading focuses, then hit generate.
        </p>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
          <ol className="space-y-3">
            {[
              "Choose 'Generate for me' to create a passage from a topic, or paste your own text.",
              "Select one or more reading focuses to target specific comprehension skills.",
              "Ideas for use: creating differentiated reading activities, revision tasks, or assessments.",
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

export default function ComprehensionGeneratorPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <ComprehensionForm sidebar={<Sidebar />} />
    </main>
  );
}

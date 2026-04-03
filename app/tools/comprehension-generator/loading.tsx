import { BookOpen, ArrowLeft, Wand2, Upload } from "lucide-react";

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-300 bg-gray-50";
const selectClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-300 bg-gray-50";

export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
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
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <ArrowLeft className="w-4 h-4" />
              Back to all tools
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5">

              {/* Curriculum + Year Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Curriculum</label>
                  <select disabled className={selectClass}><option>Choose your curriculum...</option></select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Year Group</label>
                  <select disabled className={selectClass}><option>Select year group</option></select>
                </div>
              </div>

              {/* Text Source */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Text Source</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded-md p-4 flex flex-col items-center gap-2 text-sm font-medium text-gray-400 bg-gray-50">
                    <Wand2 className="w-5 h-5" />
                    Generate for me
                  </div>
                  <div className="border border-gray-200 rounded-md p-4 flex flex-col items-center gap-2 text-sm font-medium text-gray-400 bg-gray-50">
                    <Upload className="w-5 h-5" />
                    Use my own text
                  </div>
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Topic or Prompt</label>
                <input disabled placeholder='e.g. "The life cycle of a monarch butterfly"' className={inputClass} />
              </div>

              {/* Complexity */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Complexity</label>
                <div className="flex gap-2">
                  {["Simple", "Standard", "Challenging"].map((level) => (
                    <div key={level} className="px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200 text-gray-300 bg-gray-50">{level}</div>
                  ))}
                </div>
              </div>

              {/* Reading Focuses */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Reading Focuses</label>
                <div className="flex flex-wrap gap-2">
                  {["Word meaning", "Inference", "Summarising", "Retrieval", "Predicting"].map((focus) => (
                    <div key={focus} className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-300 bg-gray-50">{focus}</div>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button disabled className="w-full bg-indigo-300 text-white py-2.5 px-6 rounded-md text-sm font-medium cursor-not-allowed">
                Generate
              </button>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

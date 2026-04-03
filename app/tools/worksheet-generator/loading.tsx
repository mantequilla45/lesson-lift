import { FileText, ArrowLeft } from "lucide-react";

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
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <h1 className="text-lg font-bold text-gray-900 mt-1.5">Worksheet Generator</h1>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                This tool can be used to create worksheets. Simply enter the year group, subject and
                learning objective you are targeting and hit generate.
              </p>
              <div className="mt-5 pt-5 border-t border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Guidance</h2>
                <ol className="space-y-3">
                  {[
                    "Read the examples in the inputs to ensure you're entering information in the correct format.",
                    "It's important to be specific when entering the learning objective.",
                    "Ideas for use: too many to mention! Whatever you need a worksheet on, this is the tool for you.",
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Curriculum</label>
                  <select disabled className={selectClass}><option>Select curriculum</option></select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Year group</label>
                  <select disabled className={selectClass}><option>Select year group</option></select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input disabled placeholder="e.g. Mathematics" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Learning objective</label>
                <textarea disabled rows={4} placeholder="e.g. Students will be able to factorise and solve quadratic equations" className={`${inputClass} resize-none`} />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">Include content from exam specification or other curriculum guidance</label>
                <div className="flex gap-5">
                  <span className="text-sm text-gray-400">Yes</span>
                  <span className="text-sm text-gray-400">No</span>
                </div>
              </div>
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

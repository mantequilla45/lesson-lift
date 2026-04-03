"use client";

import { useState } from "react";
import CurriculumYearFields, { useCurriculumYear } from "@/app/components/CurriculumYearFields";
import { toTitleCase } from "@/app/lib/formOptions";
import { Loader2, Sparkles } from "lucide-react";
import ResultPanel from "@/app/components/ResultPanel";
import ConfirmModal from "@/app/components/ConfirmModal";


export default function LessonPlannerForm({ sidebar }: { sidebar: React.ReactNode }) {
  const { curriculum, setCurriculum, yearGroup, setYearGroup } = useCurriculumYear();
  const [mixed, setMixed] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [pedagogicalTheory, setPedagogicalTheory] = useState<"yes" | "no">("no");
  const [theoryText, setTheoryText] = useState("");
  const [examSpec, setExamSpec] = useState<"yes" | "no">("no");
  const [examSpecText, setExamSpecText] = useState("");

  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const canGenerate =
    curriculum && (mixed || yearGroup) && subject.trim() && topic.trim() && learningObjective.trim();

  const formSnapshot = JSON.stringify({ curriculum, yearGroup, mixed, subject, topic, learningObjective, pedagogicalTheory, theoryText, examSpec, examSpecText });
  const unchangedSinceGeneration = result !== null && lastGenerated === formSnapshot;

  const handleGenerate = async () => {
    setError(null);
    setResult("");
    setIsGenerating(true);
    setLastGenerated(formSnapshot);
    try {
      const res = await fetch("/api/lesson-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculum,
          yearGroup: mixed ? "Mixed" : yearGroup,
          subject: toTitleCase(subject),
          topic,
          learningObjective,
          pedagogicalTheory: pedagogicalTheory === "yes" ? theoryText : null,
          examSpec: examSpec === "yes" ? examSpecText : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Generation failed");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true }).replace(/\u00A9/g, "(c)");
        setResult((prev) => (prev ?? "") + chunk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">{sidebar}</div>

        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5">

            <CurriculumYearFields
              curriculum={curriculum} onCurriculumChange={setCurriculum}
              yearGroup={yearGroup} onYearGroupChange={setYearGroup}
              mixed={mixed} onMixedChange={setMixed}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" className={inputClass} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Topic</label>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Quadratic equations" rows={3} className={`${inputClass} resize-none`} />
              <p className="text-xs text-gray-400">100,000 character maximum input text</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Learning objective</label>
              <textarea value={learningObjective} onChange={(e) => setLearningObjective(e.target.value)} placeholder="e.g. Students will be able to factorise and solve quadratic equations" rows={3} className={`${inputClass} resize-none`} />
              <p className="text-xs text-gray-400">100,000 character maximum input text</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Integrate a specific pedagogical theory</label>
              <div className="flex gap-5">
                {(["yes", "no"] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="pedagogicalTheory" value={val} checked={pedagogicalTheory === val} onChange={() => setPedagogicalTheory(val)} className="accent-indigo-600" />
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </label>
                ))}
              </div>
              {pedagogicalTheory === "yes" && (
                <input type="text" value={theoryText} onChange={(e) => setTheoryText(e.target.value)} placeholder="e.g. Bloom's Taxonomy, Vygotsky's Zone of Proximal Development..." className={`${inputClass} mt-2`} />
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Include content from exam specification or other curriculum guidance</label>
              <div className="flex gap-5">
                {(["yes", "no"] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="examSpec" value={val} checked={examSpec === val} onChange={() => setExamSpec(val)} className="accent-indigo-600" />
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </label>
                ))}
              </div>
              {examSpec === "yes" && (
                <textarea value={examSpecText} onChange={(e) => setExamSpecText(e.target.value)} placeholder="Paste relevant exam specification or curriculum guidance here..." rows={4} className={`${inputClass} resize-none mt-2`} />
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmingReset(true)} disabled={!result} className="border border-gray-300 text-gray-600 py-2.5 px-4 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                Reset
              </button>
              <ConfirmModal
                open={confirmingReset}
                title="Reset form?"
                message="This will clear your current results and reset all form inputs."
                confirmLabel="Yes, reset"
                onConfirm={() => { setCurriculum(""); setYearGroup(""); setMixed(false); setSubject(""); setTopic(""); setLearningObjective(""); setPedagogicalTheory("no"); setTheoryText(""); setExamSpec("no"); setExamSpecText(""); setResult(null); setError(null); setConfirmingReset(false); }}
                onCancel={() => setConfirmingReset(false)}
              />
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating || unchangedSinceGeneration} className="flex-1 bg-indigo-600 text-white py-2.5 px-6 rounded-md text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />{result ? "Regenerate" : "Generate"}</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">{error}</div>
      )}

      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        onChange={(md) => setResult(md)}
        exportFilename={`lesson-plan-${topic || subject || "export"}`}
      />
    </div>
  );
}

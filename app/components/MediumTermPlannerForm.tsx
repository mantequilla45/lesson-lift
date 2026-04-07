"use client";

import { useState } from "react";
import CurriculumYearFields, { useCurriculumYear } from "@/app/components/CurriculumYearFields";
import { toTitleCase } from "@/app/lib/formOptions";
import { Loader2, Sparkles } from "lucide-react";
import ResultPanel from "@/app/components/ResultPanel";
import ConfirmModal from "@/app/components/ConfirmModal";
import Card from "@/app/components/ui/Card";


export default function MediumTermPlannerForm({ sidebar }: { sidebar: React.ReactNode }) {
  const { curriculum, setCurriculum, yearGroup, setYearGroup } = useCurriculumYear();
  const [mixed, setMixed] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [numberOfLessons, setNumberOfLessons] = useState("6");
  const [examSpec, setExamSpec] = useState<"yes" | "no">("no");
  const [examSpecText, setExamSpecText] = useState("");

  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const lessonsNum = parseInt(numberOfLessons, 10);
  const canGenerate =
    curriculum && (mixed || yearGroup) && subject.trim() && topic.trim() &&
    !isNaN(lessonsNum) && lessonsNum >= 1 && lessonsNum <= 30;

  const formSnapshot = JSON.stringify({ curriculum, yearGroup, mixed, subject, topic, numberOfLessons, examSpec, examSpecText });
  const unchangedSinceGeneration = result !== null && lastGenerated === formSnapshot;

  const handleGenerate = async () => {
    setError(null);
    setResult("");
    setIsGenerating(true);
    setLastGenerated(formSnapshot);
    try {
      const res = await fetch("/api/medium-term-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculum,
          yearGroup: mixed ? "Mixed" : yearGroup,
          subject: toTitleCase(subject),
          topic,
          numberOfLessons: lessonsNum,
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
    "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-white";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">{sidebar}</div>

        <div className="lg:col-span-2">
          <Card className="space-y-6">

            <CurriculumYearFields
              curriculum={curriculum} onCurriculumChange={setCurriculum}
              yearGroup={yearGroup} onYearGroupChange={setYearGroup}
              mixed={mixed} onMixedChange={setMixed}
              yearGroupNote
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" className={inputClass} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Topic</label>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions, decimals and percentages" rows={3} className={`${inputClass} resize-none`} />
              <p className="text-xs text-gray-400">100,000 character maximum input text</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Number of lessons</label>
              <input
                type="number"
                min={1}
                max={30}
                value={numberOfLessons}
                onChange={(e) => setNumberOfLessons(e.target.value)}
                placeholder="e.g. 6"
                className={`${inputClass} w-32`}
              />
              <p className="text-xs text-gray-400">Between 1 and 30 lessons</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-2">
              <label className="block text-sm font-semibold text-gray-800">Include content from exam specification or other curriculum guidance</label>
              <div className="flex gap-5">
                {(["yes", "no"] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="examSpec" value={val} checked={examSpec === val} onChange={() => setExamSpec(val)} className="accent-gray-900" />
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </label>
                ))}
              </div>
              {examSpec === "yes" && (
                <textarea value={examSpecText} onChange={(e) => setExamSpecText(e.target.value)} placeholder="Paste relevant exam specification or curriculum guidance here..." rows={4} className={`${inputClass} resize-none mt-2`} />
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmingReset(true)} disabled={!result} className="border border-gray-200 text-gray-600 py-3 px-5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                Reset
              </button>
              <ConfirmModal
                open={confirmingReset}
                title="Reset form?"
                message="This will clear your current results and reset all form inputs."
                confirmLabel="Yes, reset"
                onConfirm={() => { setCurriculum(""); setYearGroup(""); setMixed(false); setSubject(""); setTopic(""); setNumberOfLessons("6"); setExamSpec("no"); setExamSpecText(""); setResult(null); setError(null); setConfirmingReset(false); }}
                onCancel={() => setConfirmingReset(false)}
              />
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating || unchangedSinceGeneration} className="flex-1 bg-[#1a1a1a] text-white py-3 px-6 rounded-xl text-sm font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />{result ? "Regenerate" : "Generate"}</>}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">{error}</div>
      )}

      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        onChange={(md) => setResult(md)}
        exportFilename={`medium-term-plan-${topic || subject || "export"}`}
      />
    </div>
  );
}

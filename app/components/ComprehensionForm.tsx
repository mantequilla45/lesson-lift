"use client";

import { useState, useRef } from "react";
import CurriculumYearFields, { useCurriculumYear } from "@/app/components/CurriculumYearFields";
import { toTitleCase } from "@/app/lib/formOptions";
import { Wand2, Upload, Check, Loader2, Sparkles } from "lucide-react";
import ResultPanel from "@/app/components/ResultPanel";
import ConfirmModal from "@/app/components/ConfirmModal";

const READING_FOCUSES = [
  "Word meaning",
  "Inference",
  "Summarising",
  "Analysis and evaluation",
  "Evaluation of content, structure and quality",
  "Retrieval",
  "Predicting",
  "Explaining and exploring",
  "Comparison and synthesis",
];


const COMPLEXITY_LEVELS = ["Simple", "Standard", "Challenging"] as const;
type Complexity = typeof COMPLEXITY_LEVELS[number];

export default function ComprehensionForm({ sidebar }: { sidebar: React.ReactNode }) {
  const { curriculum, setCurriculum, yearGroup, setYearGroup } = useCurriculumYear();
  const [mixed, setMixed] = useState(false);
  const [textSource, setTextSource] = useState<"generate" | "own" | "">("");
  const [complexity, setComplexity] = useState<Complexity>("Standard");
  const [readingFocuses, setReadingFocuses] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [topic, setTopic] = useState("");
  const topicInputRef = useRef<HTMLInputElement>(null);
  const [ownText, setOwnText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const formSnapshot = JSON.stringify({ curriculum, yearGroup, mixed, textSource, topic, ownText, complexity, readingFocuses, numQuestions, includeAnswerKey });
  const unchangedSinceGeneration = result !== null && lastGenerated === formSnapshot;

  const toggleFocus = (focus: string) => {
    setReadingFocuses((prev) =>
      prev.includes(focus) ? prev.filter((f) => f !== focus) : [...prev, focus]
    );
  };

  const handleGenerate = async () => {
    setError(null);
    setResult("");
    setIsGenerating(true);
    setLastGenerated(formSnapshot);
    try {
      const res = await fetch("/api/comprehension-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculum,
          yearGroup: mixed ? "Mixed" : yearGroup,
          textSource,
          topic: textSource === "generate" ? topic : undefined,
          ownText: textSource === "own" ? ownText : undefined,
          readingFocuses,
          numQuestions,
          complexity,
          includeAnswerKey,
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

  const canGenerate =
    curriculum &&
    (mixed || yearGroup) &&
    textSource &&
    (textSource === "own" ? ownText.trim() : topic.trim()) &&
    readingFocuses.length > 0;

  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  const selectClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white";

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

            {/* Text Source */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Text Source</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setTextSource("generate"); setTimeout(() => topicInputRef.current?.focus(), 0); }}
                  className={`border rounded-md p-4 flex flex-col items-center gap-2 text-sm font-medium cursor-pointer transition-colors ${
                    textSource === "generate"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Wand2 className="w-5 h-5" />
                  Generate for me
                </button>
                <button
                  type="button"
                  onClick={() => setTextSource("own")}
                  className={`border rounded-md p-4 flex flex-col items-center gap-2 text-sm font-medium cursor-pointer transition-colors ${
                    textSource === "own"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  Use my own text
                </button>
              </div>
            </div>

            {/* Topic or Own Text */}
            {textSource === "generate" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Topic or Prompt</label>
                <input
                  ref={topicInputRef}
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder='e.g. "The life cycle of a monarch butterfly"'
                  className={inputClass}
                />
              </div>
            )}
            {textSource === "own" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Your Text</label>
                <textarea
                  value={ownText}
                  onChange={(e) => setOwnText(e.target.value)}
                  placeholder="Paste your text here..."
                  rows={6}
                  className={`${inputClass} resize-none`}
                />
              </div>
            )}

            {/* Complexity */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Complexity</label>
              <div className="flex gap-2">
                {COMPLEXITY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setComplexity(level)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      complexity === level
                        ? "bg-indigo-600 text-white"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Focuses */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Reading Focuses</label>
              <div className="flex flex-wrap gap-2">
                {READING_FOCUSES.map((focus) => (
                  <button
                    key={focus}
                    type="button"
                    onClick={() => toggleFocus(focus)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      readingFocuses.includes(focus)
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {focus}
                    {readingFocuses.includes(focus) && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions per focus + Answer Key */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Questions per focus</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNumQuestions((p) => Math.max(1, p - 1))}
                    className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-gray-900 tabular-nums">{numQuestions}</span>
                  <button
                    type="button"
                    onClick={() => setNumQuestions((p) => p + 1)}
                    className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="answer-key" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Include answer key
                </label>
                <input
                  id="answer-key"
                  type="checkbox"
                  checked={includeAnswerKey}
                  onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                  className="rounded accent-indigo-600 w-4 h-4 cursor-pointer"
                />
              </div>
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
                onConfirm={() => { setCurriculum(""); setYearGroup(""); setMixed(false); setTextSource(""); setComplexity("Standard"); setReadingFocuses([]); setNumQuestions(5); setIncludeAnswerKey(true); setTopic(""); setOwnText(""); setResult(null); setError(null); setConfirmingReset(false); }}
                onCancel={() => setConfirmingReset(false)}
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating || unchangedSinceGeneration}
                className="flex-1 bg-indigo-600 text-white py-2.5 px-6 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                  : <><Sparkles className="w-4 h-4" />{result ? "Regenerate" : "Generate"}</>}
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
        exportFilename="comprehension-activity"
      />
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import RichTextEditor from "./RichTextEditor";

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** and *italic* tokens
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function MarkdownResult({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="font-black text-base uppercase tracking-tight mt-6 mb-2" style={{ fontFamily: "var(--font-headline)" }}>
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="font-black text-lg uppercase tracking-tight mt-8 mb-3 border-b-2 border-[#1C1B1B] pb-2" style={{ fontFamily: "var(--font-headline)" }}>
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="font-black text-2xl uppercase tracking-tighter mb-4" style={{ fontFamily: "var(--font-headline)" }}>
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (/^---+$/.test(line.trim())) {
      elements.push(
        <hr key={i} className="border-t-2 border-[#1C1B1B]/20 my-6" />
      );
    } else if (/^\d+\.\s/.test(line)) {
      // Collect consecutive numbered list items
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-2 my-3 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3 text-sm leading-relaxed">
              <span className="font-black text-[#7D89D8] shrink-0 w-5 text-right">{j + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (/^[-*]\s/.test(line)) {
      // Collect consecutive bullet list items
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-2 my-3 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3 text-sm leading-relaxed">
              <span className="text-[#7D89D8] shrink-0 font-black">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      // skip blank lines (spacing handled by margins)
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed my-2">
          {renderInline(line)}
        </p>
      );
    }

    i++;
  }

  return <div>{elements}</div>;
}

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

const CURRICULA: { label: string; value: string }[] = [
  { label: "2014 National Curriculum", value: "2014 National Curriculum" },
  { label: "Early Years Foundation Stage (EYFS)", value: "Early Years Foundation Stage (EYFS)" },
  { label: "Scottish Curriculum for Excellence", value: "Scottish Curriculum for Excellence" },
  { label: "Welsh Curriculum", value: "Welsh Curriculum" },
  { label: "Northern Ireland Curriculum", value: "Northern Ireland Curriculum" },
];

const YEAR_GROUPS = [
  "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11",
];

const COMPLEXITY_LEVELS = ["Simple", "Standard", "Challenging"] as const;
type Complexity = typeof COMPLEXITY_LEVELS[number];

export default function ComprehensionForm() {
  const [curriculum, setCurriculum] = useState("");
  const [yearGroup, setYearGroup] = useState("");
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
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFocus = (focus: string) => {
    setReadingFocuses((prev) =>
      prev.includes(focus) ? prev.filter((f) => f !== focus) : [...prev, focus]
    );
  };

  useEffect(() => {
    if (!isGenerating) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        // Slow down as it approaches 90% — never reaches 100% until done
        const remaining = 90 - p;
        return p + remaining * 0.04;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setProgress(100);
      setResult(data.output);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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

  return (
    <div className="space-y-10">
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-10 transition-opacity ${isGenerating ? "pointer-events-none opacity-50" : ""}`}>
        {/* Left column */}
        <div className="lg:col-span-7 space-y-10">
          {/* Step 1 */}
          <section className="bg-white bold-border p-8 neo-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span
                className="w-10 h-10 bg-[#FFCC33] bold-border flex items-center justify-center font-black text-lg"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                1
              </span>
              <h2
                className="font-black text-2xl uppercase tracking-tight"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                Context &amp; Core
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block font-black text-xs uppercase tracking-widest text-[#1C1B1B]/50" style={{ fontFamily: "var(--font-headline)" }}>
                  Curriculum
                </label>
                <select
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  className="w-full bg-white bold-border p-4 font-bold appearance-none focus:outline-none rounded-none text-sm"
                  style={{ color: "#1C1B1B" }}
                >
                  <option value="" disabled>Choose your curriculum...</option>
                  {CURRICULA.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-black text-xs uppercase tracking-widest text-[#1C1B1B]/50" style={{ fontFamily: "var(--font-headline)" }}>
                    Year Group
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mixed}
                      onChange={(e) => setMixed(e.target.checked)}
                      className="w-4 h-4 accent-[#FFCC33]"
                    />
                    <span className="font-black text-xs uppercase tracking-widest text-[#1C1B1B]/50" style={{ fontFamily: "var(--font-headline)" }}>Mixed</span>
                  </label>
                </div>
                <select
                  value={yearGroup}
                  onChange={(e) => setYearGroup(e.target.value)}
                  disabled={mixed}
                  className="w-full bg-white bold-border p-4 font-bold appearance-none focus:outline-none rounded-none text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: "#1C1B1B" }}
                >
                  <option value="" disabled>Select year group</option>
                  {YEAR_GROUPS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="bg-white bold-border p-8 neo-shadow">
            <div className="flex items-center gap-4 mb-8">
              <span
                className="w-10 h-10 bg-[#7D89D8] text-white bold-border flex items-center justify-center font-black text-lg"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                2
              </span>
              <h2
                className="font-black text-2xl uppercase tracking-tight"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                Text Source
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => { setTextSource("generate"); setTimeout(() => topicInputRef.current?.focus(), 0); }}
                className={`bold-border p-6 flex flex-col items-center gap-3 transition-all neo-shadow-sm ${
                  textSource === "generate" ? "bg-[#FFCC33]" : "bg-white opacity-40 hover:opacity-100"
                }`}
              >
                <WandIcon className="w-8 h-8" />
                <span className="font-black uppercase text-sm" style={{ fontFamily: "var(--font-headline)" }}>Generate for me</span>
              </button>
              <button
                type="button"
                onClick={() => setTextSource("own")}
                className={`bold-border p-6 flex flex-col items-center gap-3 transition-all ${
                  textSource === "own" ? "bg-[#FFCC33] neo-shadow-sm" : "bg-white opacity-40 hover:opacity-100"
                }`}
              >
                <UploadIcon className="w-8 h-8" />
                <span className="font-black uppercase text-sm" style={{ fontFamily: "var(--font-headline)" }}>Use my own text</span>
              </button>
            </div>

            <div className="space-y-6">
              {textSource === "generate" && (
                <div className="space-y-3">
                  <label className="block font-black text-xs uppercase tracking-widest text-[#1C1B1B]/50" style={{ fontFamily: "var(--font-headline)" }}>
                    Topic or Prompt
                  </label>
                  <input
                    ref={topicInputRef}
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder='e.g. "The life cycle of a monarch butterfly" or "The Battle of Hastings"'
                    className="w-full bg-[#F3F3F3] bold-border p-4 font-bold placeholder:text-[#1C1B1B]/30 focus:bg-white focus:outline-none rounded-none text-sm"
                  />
                </div>
              )}

              {textSource === "own" && (
                <div className="space-y-3">
                  <label className="block font-black text-xs uppercase tracking-widest text-[#1C1B1B]/50" style={{ fontFamily: "var(--font-headline)" }}>
                    Your Text
                  </label>
                  <textarea
                    value={ownText}
                    onChange={(e) => setOwnText(e.target.value)}
                    placeholder="Paste your text here — an article, story extract, or any passage you'd like to build questions around..."
                    rows={6}
                    className="w-full bg-[#F3F3F3] bold-border p-4 font-bold placeholder:text-[#1C1B1B]/30 focus:bg-white focus:outline-none rounded-none text-sm resize-none"
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="block font-black text-xs uppercase tracking-widest text-[#1C1B1B]/50" style={{ fontFamily: "var(--font-headline)" }}>
                  Complexity Level
                </label>
                <div className="flex flex-wrap gap-3">
                  {COMPLEXITY_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setComplexity(level)}
                      className={`px-6 py-3 bold-border font-black text-xs uppercase transition-colors ${
                        complexity === level ? "bg-[#FFCC33]" : "bg-white hover:bg-[#FFCC33]"
                      }`}
                      style={{ fontFamily: "var(--font-headline)" }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 h-full">
          <section className="bg-[#7D89D8] text-white bold-border p-8 neo-shadow h-full flex flex-col">
            <div className="flex items-center gap-4 mb-10">
              <span
                className="w-10 h-10 bg-white text-[#1C1B1B] bold-border flex items-center justify-center font-black text-lg"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                3
              </span>
              <h2
                className="font-black text-2xl uppercase tracking-tight"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                Reading Focus
              </h2>
            </div>

            <div className="flex-1 space-y-10">
              {/* Focus chips */}
              <div className="flex flex-wrap gap-3">
                {READING_FOCUSES.map((focus) => (
                  <button
                    key={focus}
                    type="button"
                    onClick={() => toggleFocus(focus)}
                    className={`bold-border px-4 py-3 font-black text-xs uppercase transition-colors flex items-center gap-2 ${
                      readingFocuses.includes(focus)
                        ? "bg-[#FFCC33] text-[#1C1B1B]"
                        : "bg-white text-[#1C1B1B] opacity-90 hover:bg-[#FFCC33]"
                    }`}
                    style={{ fontFamily: "var(--font-headline)" }}
                  >
                    {focus}
                    {readingFocuses.includes(focus) && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Options */}
              <div className="bg-[#1C1B1B]/10 bold-border p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase text-xs tracking-widest" style={{ fontFamily: "var(--font-headline)" }}>
                    Questions Per Focus
                  </span>
                  <div className="flex items-center gap-4 bg-white text-[#1C1B1B] bold-border p-1">
                    <button
                      type="button"
                      onClick={() => setNumQuestions((p) => Math.max(1, p - 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-[#FFCC33] font-black text-lg transition-colors"
                    >
                      −
                    </button>
                    <span className="font-black text-xl w-6 text-center tabular-nums">{numQuestions}</span>
                    <button
                      type="button"
                      onClick={() => setNumQuestions((p) => p + 1)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-[#FFCC33] font-black text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-black uppercase text-xs tracking-widest" style={{ fontFamily: "var(--font-headline)" }}>
                    Include Answer Key
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncludeAnswerKey((p) => !p)}
                    className="w-14 h-8 bg-white bold-border relative flex items-center cursor-pointer p-1"
                  >
                    <div
                      className={`w-6 h-6 bold-border absolute transition-all ${
                        includeAnswerKey ? "bg-[#FFCC33] right-1" : "bg-white/50 left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Generate */}
              <div className="pt-8">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="w-full bg-[#FFCC33] text-[#1C1B1B] bold-border py-6 font-black text-2xl uppercase tracking-tighter neo-shadow hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[6px_6px_0px_0px_#1C1B1B] flex items-center justify-center gap-3"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {isGenerating ? (
                    <>
                      <SpinnerIcon className="w-6 h-6 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Activity"
                  )}
                </button>
                <p className="text-center text-[10px] mt-6 font-black uppercase tracking-[0.2em] opacity-60">
                  Estimated time: 15 seconds
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bold-border bg-white p-4 text-sm font-bold text-red-600 neo-shadow-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white bold-border neo-shadow overflow-hidden">
          <div className="flex items-center justify-between px-8 py-4 border-b-2 border-[#1C1B1B] bg-[#FFCC33]">
            <span className="font-black text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-headline)" }}>
              Generated Activity
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing((p) => !p)}
                className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest bold-border px-3 py-1.5 transition-colors ${
                  isEditing ? "bg-[#1C1B1B] text-white" : "bg-white hover:bg-[#1C1B1B] hover:text-white"
                }`}
                style={{ fontFamily: "var(--font-headline)" }}
              >
                {isEditing ? <EyeIcon className="w-3.5 h-3.5" /> : <PencilIcon className="w-3.5 h-3.5" />}
                {isEditing ? "Preview" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(result)}
                className="flex items-center gap-2 font-black text-xs uppercase tracking-widest bold-border px-3 py-1.5 bg-white hover:bg-[#1C1B1B] hover:text-white transition-colors"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                <CopyIcon className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>
          {isEditing ? (
            <RichTextEditor value={result} onChange={(md) => setResult(md)} />
          ) : (
            <div className="p-8">
              <MarkdownResult text={result} />
            </div>
          )}
        </div>
      )}

      {/* Bottom status bar */}
      {isGenerating && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="w-full max-w-7xl px-8 pb-6 md:px-12">
            <div className="bg-dark text-white bold-border neo-shadow overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-4">
                <SpinnerIcon className="w-5 h-5 animate-spin shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs uppercase tracking-widest text-primary" style={{ fontFamily: "var(--font-headline)" }}>
                    Generating Activity
                  </p>
                  <p className="text-white/50 text-xs font-medium mt-0.5 truncate">
                    Claude is writing your comprehension activity — this takes around 15 seconds
                  </p>
                </div>
                <span className="font-black text-sm tabular-nums text-primary shrink-0">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-3 bg-white/10 relative">
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2m0 12v-2M7.343 6.343l-1.414-1.414m10.485 10.485-1.414-1.414M20 11h2M4 11H2m13.657-4.657 1.414-1.414M6.343 17.657l-1.414 1.414" />
      <path d="m9 11 1.5 1.5L15 7" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

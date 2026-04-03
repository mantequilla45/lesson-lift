"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";

interface RefinePanelProps {
  onRefine: (instruction: string) => void;
  isRefining: boolean;
  chips?: string[];
}

const DEFAULT_CHIPS = [
  "Make more concise",
  "Make longer",
  "Increase the complexity",
  "Reduce the complexity",
  "Add more detail",
  "Translate to French",
];

export default function RefinePanel({ onRefine, isRefining, chips = DEFAULT_CHIPS }: RefinePanelProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || isRefining) return;
    onRefine(trimmed);
    setInstruction("");
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Want to refine your results?</h3>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">What would you like to change?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Type changes here"
            disabled={isRefining}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!instruction.trim() || isRefining}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0"
          >
            {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isRefining ? "Refining..." : "Refine"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setInstruction(chip)}
            disabled={isRefining}
            className="text-xs border border-gray-300 rounded-full px-3 py-1.5 text-gray-600 bg-white hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

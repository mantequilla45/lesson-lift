"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

interface Props {
  initialTopic: string;
  initialInstructions: string;
  onClose: () => void;
  /** Regenerate the deck with the edited prompt. Keeps all other saved settings
   *  (theme, images, audio, etc.). */
  onSubmit: (v: { topic: string; additionalInstructions: string }) => void;
}

export default function EditPromptModal({ initialTopic, initialInstructions, onClose, onSubmit }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [instructions, setInstructions] = useState(initialInstructions);

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
        style={{ borderColor: "#EAE6F5", backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-start gap-3 p-6 pb-4 border-b" style={{ borderColor: "#EAE6F5" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--j-purple)" }}>
            <Pencil className="w-5 h-5" style={{ color: "#fff" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900">Edit prompt & regenerate</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Adjust the topic or instructions and rebuild the deck. Your theme, image, and audio
              settings are kept.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The French Revolution"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              style={{ borderColor: "#EAE6F5", backgroundColor: "#fff" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Additional instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="e.g. Pitch it as a children's storybook; keep sentences short and playful."
              className="w-full rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/10"
              style={{ borderColor: "#EAE6F5", backgroundColor: "#fff" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-6 pt-2">
          <p className="text-xs text-gray-400">This replaces the current deck.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold rounded-xl border px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
              style={{ borderColor: "#EAE6F5" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!topic.trim()}
              onClick={() => onSubmit({ topic: topic.trim(), additionalInstructions: instructions.trim() })}
              className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "var(--j-purple)" }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

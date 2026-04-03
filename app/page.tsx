const TOOLS = [
  {
    href: "/tools/comprehension-generator",
    icon: "comprehension",
    label: "Comprehension Generator",
    description: "Create bespoke reading comprehension activities tailored to your students.",
    tag: "Literacy",
  },
  {
    href: "/tools/lesson-planner",
    icon: "planner",
    label: "Lesson Planner",
    description: "Draft structured lesson plans from a topic and learning objective in seconds.",
    tag: "Planning",
  },
  {
    href: "/tools/worksheet-generator",
    icon: "worksheet",
    label: "Worksheet Generator",
    description: "Create bespoke worksheets tailored to your year group, subject and learning objective.",
    tag: "Assessment",
  },
  {
    href: "/tools/topic-overview",
    icon: "topic",
    label: "Topic Overview",
    description: "Generate a structured topic overview with lesson summaries aligned to your curriculum.",
    tag: "Planning",
  },
  {
    href: "/tools/medium-term-planner",
    icon: "medium-term",
    label: "Medium Term Topic Planner",
    description: "Build a full lesson-by-lesson medium term plan with objectives and key knowledge for any topic.",
    tag: "Planning",
  },
  {
    href: "/tools/eyfs-planner",
    icon: "eyfs",
    label: "EYFS Planner",
    description: "Generate a full Early Years plan covering all 7 EYFS learning areas with indoor, outdoor, and adult-led activities.",
    tag: "Early Years",
  },
  {
    href: "/tools/model-text-generator",
    icon: "model-text",
    label: "Model Text Generator",
    description: "Generate model texts with specific writing features, tailored to your year group and topic.",
    tag: "Literacy",
  },
  {
    href: "/tools/sensory-activities",
    icon: "sensory",
    label: "Sensory Activities",
    description: "Generate 5 multisensory activity ideas for any topic, with resources, adaptations and cross-curricular links.",
    tag: "SEND",
  },
  {
    href: "/tools/phonics-support",
    icon: "phonics",
    label: "Phonics Support",
    description: "Generate word banks, decodable texts, pseudo-words, and teaching activities for any target phoneme.",
    tag: "Literacy",
  },
  {
    href: "/tools/model-answer-generator",
    icon: "model-answer",
    label: "Model Answer Generator",
    description: "Generate model answers for exam-style questions worth varying marks, with teacher notes and assessment criteria.",
    tag: "Assessment",
  },
  {
    href: "/tools/quiz-generator",
    icon: "quiz",
    label: "Quiz Generator",
    description: "Generate a fully editable multiple choice quiz on any topic, then export to Kahoot, Blooket, Gimkit, and more.",
    tag: "Assessment",
  },
];

import Link from "next/link";
import { User, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <span className="text-xl font-bold text-gray-900">
              Lesson Lift
            </span>
            <div className="hidden md:flex gap-8">
              {["Dashboard", "My Texts", "Curriculum"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Teacher Pro</span>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Your Tools
          </h1>
          <p className="text-lg text-gray-500">
            AI-powered tools built for teachers. Pick a tool and get started.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <ToolIcon name={tool.icon} className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  {tool.tag}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">{tool.label}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
              </div>
              <div className="mt-auto pt-2 flex items-center gap-1 text-sm text-indigo-600 font-medium">
                Open tool
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 px-8 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="font-bold text-gray-900">Lesson Lift</span>
            <p className="text-sm text-gray-400 mt-1">
              © 2025 The Structured Playground for Educators
            </p>
          </div>
          <div className="flex gap-8">
            {["Privacy", "Terms", "Support"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function ToolIcon({ name, className }: { name: string; className?: string }) {
  if (name === "comprehension") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
      </svg>
    );
  }
  if (name === "planner") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeWidth={2.5} />
      </svg>
    );
  }
  if (name === "worksheet") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  }
  if (name === "topic") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (name === "medium-term") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    );
  }
  if (name === "sensory") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 9H9c-1-3-4-5-4-9a7 7 0 0 1 7-7z" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    );
  }
  if (name === "model-text") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    );
  }
  if (name === "eyfs") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        <path d="M9 12.5c-1 1.5-1.5 3-1.5 4.5" strokeDasharray="1.5 1.5" />
        <path d="M15 12.5c1 1.5 1.5 3 1.5 4.5" strokeDasharray="1.5 1.5" />
      </svg>
    );
  }
  if (name === "phonics") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
        <path d="M6 12h5" />
        <path d="M13 12h5" />
      </svg>
    );
  }
  if (name === "model-answer") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (name === "quiz") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} />
      </svg>
    );
  }
  return null;
}

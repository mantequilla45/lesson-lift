"use client";

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
  {
    href: "/tools/report-writer",
    icon: "report",
    label: "Report Writer",
    description: "Generate personalised pupil reports from strengths, areas for development, and targets across multiple subjects.",
    tag: "Assessment",
  },
  {
    href: "/tools/smart-targets",
    icon: "smart-targets",
    label: "SMART Targets",
    description: "Turn raw targets into a fully structured SMART table — specific, measurable, achievable, relevant, and time-bound.",
    tag: "SEND",
  },
  {
    href: "/tools/cpd-slideshow",
    icon: "cpd-slideshow",
    label: "CPD Slideshow Generator",
    description: "Generate a professional development presentation for teachers, with slide-by-slide content, bullet points, and image suggestions.",
    tag: "Planning",
  },
  {
    href: "/tools/policy-generator",
    icon: "policy",
    label: "Policy Generator",
    description: "Draft a full school policy or a policy section structure for any area of school life, ready to customise for your setting.",
    tag: "Planning",
  },
  {
    href: "/tools/one-page-profile",
    icon: "one-page-profile",
    label: "One Page Support Profile",
    description: "Turn notes from a pupil discussion into a first-person, student-centred one page profile for use with student passports or internal guidance documents.",
    tag: "SEND",
  },
  {
    href: "/tools/risk-assessment",
    icon: "risk-assessment",
    label: "Risk Assessment",
    description: "Draft a risk assessment for any school trip or activity, with hazards, likelihood, severity, control measures, and further actions.",
    tag: "Planning",
  },
  {
    href: "/tools/behaviour-support-plan",
    icon: "behaviour-support-plan",
    label: "Individual Student Behaviour Plan",
    description: "Generate a comprehensive behaviour plan with strategies, targets, de-escalation guidance, and monitoring tools for a student with challenging behaviour.",
    tag: "SEND",
  },
  {
    href: "/tools/ect-report-writer",
    icon: "ect-report",
    label: "ECT Report Writer",
    description: "Draft evidence-based ECT assessment reports with Teacher Standards references, development plans, and recommended resources.",
    tag: "Leadership",
  },
  {
    href: "/tools/eyfs-action-plan",
    icon: "eyfs-action-plan",
    label: "EYFS Action Plan",
    description: "Generate a structured 4-phase action plan for any EYFS improvement objective, with responsibilities, monitoring, and resource requirements.",
    tag: "Early Years",
  },
  {
    href: "/tools/inspection-prep",
    icon: "inspection-prep",
    label: "Inspection Prep Questions",
    description: "Generate self-evaluation questions and preparation actions for any inspection or accreditation body, with optional evidence examples and success criteria.",
    tag: "Leadership",
  },
  {
    href: "/tools/learning-walk-report",
    icon: "learning-walk",
    label: "Learning Walk Report",
    description: "Draft a professional learning walk report from your observations, with optional recommendations and a next steps timeline.",
    tag: "Leadership",
  },
  {
    href: "/tools/lesson-observation-report",
    icon: "lesson-observation",
    label: "Lesson Observation Report",
    description: "Write up a formal lesson observation report from your notes, with optional action plan and follow-up support suggestions.",
    tag: "Leadership",
  },
  {
    href: "/tools/meeting-planner",
    icon: "meeting-planner",
    label: "Meeting Planner",
    description: "Plan a structured, productive meeting with a facilitation guide, timed agenda, discussion structure, and optional action items.",
    tag: "Leadership",
  },
  {
    href: "/tools/performance-management",
    icon: "performance-management",
    label: "Performance Management Targets",
    description: "Draft SMART performance management targets for any staff role, with objectives, success criteria, evidence, actions, timescales, and review points.",
    tag: "Leadership",
  },
  {
    href: "/tools/letter-writer",
    icon: "letter-writer",
    label: "Letter Writer",
    description: "Draft letters to parents, staff, governors, or any recipient — simply provide the key information and tone and the AI will write it for you.",
    tag: "Leadership",
  },
  {
    href: "/tools/pupil-premium-planner",
    icon: "pupil-premium",
    label: "Pupil Premium Planner",
    description: "Generate evidence-based Tier 1, 2, and 3 strategies for any Pupil Premium challenge, aligned with DfE guidance and EEF research.",
    tag: "Leadership",
  },
  {
    href: "/tools/assembly-planner",
    icon: "assembly",
    label: "Assembly Planner",
    description: "Plan a complete assembly around any theme — with a timed script, speaker notes, story, interactive element, and delivery guidance.",
    tag: "Planning",
  },
  {
    href: "/tools/newsletter-writer",
    icon: "newsletter",
    label: "Newsletter Writer",
    description: "Write a school newsletter with the tone of your choice, covering as many sections as you need — for parents, staff, or the whole community.",
    tag: "Leadership",
  },
  {
    href: "/tools/school-improvement-plan",
    icon: "sip",
    label: "School Improvement Plans",
    description: "Draft a detailed, inspection-ready SIP with objectives, action steps, timelines, budget, monitoring schedule, and risk assessment — in table or narrative format.",
    tag: "Leadership",
  },
];

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Search, Database } from "lucide-react";
import { FaPenNib } from "react-icons/fa";
import { MdAssistant } from "react-icons/md";
import { BiSolidDashboard } from "react-icons/bi";
import { RiFolder6Fill } from "react-icons/ri";

const TAG_COLORS: Record<string, { bg: string; icon: string }> = {
  Planning:     { bg: "bg-blue-100",   icon: "text-blue-600" },
  Literacy:     { bg: "bg-orange-100", icon: "text-orange-500" },
  Assessment:   { bg: "bg-purple-100", icon: "text-purple-600" },
  "Early Years":{ bg: "bg-green-100",  icon: "text-green-600" },
  SEND:         { bg: "bg-teal-100",   icon: "text-teal-600" },
  Leadership:   { bg: "bg-red-100",    icon: "text-red-500" },
};

const PINNED_HREFS = ["/tools/lesson-planner", "/tools/worksheet-generator"];

const NAV = [
  { label: "Dashboard",    icon: BiSolidDashboard, href: "#" },
  { label: "Tools",        icon: FaPenNib,         href: "/", active: true },
  { label: "Folders",      icon: RiFolder6Fill,    href: "#" },
  { label: "AI assistant", icon: MdAssistant,       href: "#" },
];

export default function Home() {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const pinned = TOOLS.filter((t) => PINNED_HREFS.includes(t.href));
  const rest   = TOOLS.filter((t) => !PINNED_HREFS.includes(t.href));

  const filteredPinned = pinned.filter(
    (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );
  const filteredRest = rest.filter(
    (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "var(--font-manrope, Manrope, sans-serif)", backgroundColor: "#f5f3eb" }}>

      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 px-6 py-8" style={{ borderRight: "1px solid rgba(229,231,235,0.5)" }}>
        <div className="flex items-center justify-between mb-10">
          <span className="text-xl font-extrabold" style={{ color: "#4a4a4a" }}>Lesson Lift</span>
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <nav className="space-y-1 grow">
          {NAV.map(({ label, icon: Icon, href, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-full transition-colors ${
                active
                  ? "bg-[#1a1a1a] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Pinned tools widget */}
        <div className="mt-auto rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid #e5e7eb" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pinned tools</span>
          </div>
          <div className="space-y-3">
            {pinned.map((t) => {
              const colors = TAG_COLORS[t.tag] ?? { bg: "bg-gray-100", icon: "text-gray-600" };
              return (
                <Link key={t.href} href={t.href} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                  <div className={`w-4 h-4 rounded-sm flex items-center justify-center ${colors.bg}`}>
                    <ToolIcon name={t.icon} className={`w-3 h-3 ${colors.icon}`} />
                  </div>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="grow flex flex-col overflow-y-auto">

        {/* Top bar */}
        <header className="flex items-center justify-between px-10 py-6">
          <h2 className="text-2xl font-bold text-gray-900 shrink-0">Tools</h2>
          <div className="grow max-w-xl mx-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-full text-sm font-bold bg-white hover:bg-gray-50 transition-colors shrink-0">
            <Database className="w-4 h-4" />
            Connect Storage
          </button>
        </header>

        <div className="px-10 pb-16 space-y-8">

          {/* Hero search */}
          <section className="bg-white rounded-3xl p-8 shadow-sm">
            <h3 className="text-2xl font-bold mb-5">What would you like to do?</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a tool"
                className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl bg-gray-50/50 text-base placeholder-gray-400 focus:outline-none focus:border-gray-200 transition-all"
              />
            </div>
          </section>

          {/* Pinned */}
          {filteredPinned.length > 0 && (
            <section>
              <div className="flex items-center gap-4 mb-5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">Pinned</h4>
                <div className="h-px bg-gray-200 w-full" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {filteredPinned.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
              </div>
            </section>
          )}

          {/* All tools */}
          {filteredRest.length > 0 && (
            <section>
              <div className="flex items-center gap-4 mb-5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">All tools</h4>
                <div className="h-px bg-gray-200 w-full" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {filteredRest.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
              </div>
            </section>
          )}

          {filteredPinned.length === 0 && filteredRest.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-16">No tools match your search.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function ToolCard({ tool }: { tool: typeof TOOLS[number] }) {
  const colors = TAG_COLORS[tool.tag] ?? { bg: "bg-gray-100", icon: "text-gray-600" };
  return (
    <Link
      href={tool.href}
      className="flex gap-5 items-start p-6 bg-white border border-gray-100 rounded-2xl cursor-pointer transition-shadow hover:shadow-md"
    >
      <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg ${colors.bg}`}>
        <ToolIcon name={tool.icon} className={`w-5 h-5 ${colors.icon}`} />
      </div>
      <div className="min-w-0">
        <h5 className="font-bold text-[15px] leading-tight mb-1 text-gray-900">{tool.label}</h5>
        <p className="text-sm text-gray-500 font-medium leading-snug">{tool.description}</p>
      </div>
    </Link>
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
  if (name === "cpd-slideshow") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }
  if (name === "letter-writer") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }
  if (name === "performance-management") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (name === "meeting-planner") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="8" y2="18" />
        <line x1="12" y1="14" x2="12" y2="18" />
        <line x1="16" y1="14" x2="16" y2="18" />
      </svg>
    );
  }
  if (name === "lesson-observation") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (name === "learning-walk") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l3-9 4 18 3-9h4" />
      </svg>
    );
  }
  if (name === "inspection-prep") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    );
  }
  if (name === "eyfs-action-plan") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
        <path d="M12 12v4" />
      </svg>
    );
  }
  if (name === "ect-report") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "behaviour-support-plan") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    );
  }
  if (name === "risk-assessment") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} />
      </svg>
    );
  }
  if (name === "one-page-profile") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        <line x1="8" y1="12" x2="6" y2="20" strokeDasharray="2 2" />
        <line x1="16" y1="12" x2="18" y2="20" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (name === "sip") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  if (name === "newsletter") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="7" y1="15" x2="17" y2="15" />
      </svg>
    );
  }
  if (name === "assembly") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === "pupil-premium") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  }
  if (name === "policy") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (name === "smart-targets") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  if (name === "report") {
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
  return null;
}

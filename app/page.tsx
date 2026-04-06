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
import { CiSearch } from "react-icons/ci";
import SideNav from "@/app/components/layout/SideNav";
import TopBar from "@/app/components/layout/TopBar";
import Card from "@/app/components/ui/Card";
import {
  MdMenuBook, MdCalendarMonth, MdAssignment, MdCheckBox, MdGridView,
  MdLightbulb, MdEdit, MdEmojiPeople, MdTextFields, MdFactCheck,
  MdHelp, MdDesktopMac, MdEmail, MdAccessTime, MdDateRange,
  MdVisibility, MdTrendingUp, MdSearch, MdAssignmentTurnedIn,
  MdDescription, MdPlaylistAdd, MdWarning, MdBadge, MdShowChart,
  MdNewspaper, MdGroups, MdBarChart, MdSecurity, MdTrackChanges,
  MdSummarize,
} from "react-icons/md";

const TAG_COLORS: Record<string, { bg: string; icon: string }> = {
  Planning: { bg: "bg-blue-100", icon: "text-blue-600" },
  Literacy: { bg: "bg-amber-100", icon: "text-amber-600" },
  Assessment: { bg: "bg-violet-100", icon: "text-violet-600" },
  "Early Years": { bg: "bg-emerald-100", icon: "text-emerald-600" },
  SEND: { bg: "bg-emerald-100", icon: "text-emerald-600" },
  Leadership: { bg: "bg-rose-100", icon: "text-rose-600" },
};

const PINNED_HREFS = ["/tools/lesson-planner", "/tools/worksheet-generator"];

export default function Home() {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const pinned = TOOLS.filter((t) => PINNED_HREFS.includes(t.href));
  const rest = TOOLS.filter((t) => !PINNED_HREFS.includes(t.href));

  const filteredPinned = pinned.filter(
    (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );
  const filteredRest = rest.filter(
    (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>

      <SideNav />

      {/* Main */}
      <main className="grow flex flex-col overflow-y-auto">
        <TopBar title="Tools" showSearch searchValue={query} onSearchChange={setQuery} />

        <div className="px-10 pb-16 space-y-4">

          {/* Hero search */}
          <Card>
            <h3 className="text-2xl font-medium mb-5">What would you like to do?</h3>
            <div className="relative">
              <CiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a tool"
                className="w-full pl-12 pr-3 py-3 border border-[#F1EFE3] font-light rounded-2xl bg-white text-sm placeholder-[#A5A5A5] focus:outline-none focus:border-line transition-all"
              />
            </div>
          </Card>

          <Card className="p-10">
            {/* Pinned */}
            {filteredPinned.length > 0 && (
              <section className=" mb-5">
                <div className="flex items-center gap-4 mb-5">
                  <h4 className="text-sm text-muted shrink-0">Pinned</h4>
                  <div className="h-px bg-muted/30 w-full" />
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))" }}>
                  {filteredPinned.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
                </div>
              </section>
            )}

            {/* All tools */}
            {filteredRest.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-5">
                  <h4 className="text-sm text-muted shrink-0">All tools</h4>
                  <div className="h-px bg-muted/30 w-full" />
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))" }}>
                  {filteredRest.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
                </div>
              </section>
            )}
          </Card>

          {filteredPinned.length === 0 && filteredRest.length === 0 && (
            <p className="text-sm text-muted text-center py-16">No tools match your search.</p>
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
      className="group flex gap-4 items-start p-5 border border-line rounded-2xl cursor-pointer hover:bg-[#F1EFE3] hover:border-[#F1EFE3]"
    >
      <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-colors bg-[#F1EFE3] group-hover:bg-white`}>
        <ToolIcon name={tool.icon} className={`w-5 h-5 ${colors.icon}`} />
      </div>
      <div className="min-w-0">
        <h5 className="font-semibold text-md  mb-0.5">{tool.label}</h5>
        <p className="text-sm text-muted font-light line-clamp-2">{tool.description}</p>
      </div>
    </Link>
  );
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "comprehension": MdMenuBook,
  "planner": MdCalendarMonth,
  "worksheet": MdAssignment,
  "topic": MdCheckBox,
  "medium-term": MdGridView,
  "sensory": MdLightbulb,
  "model-text": MdEdit,
  "eyfs": MdEmojiPeople,
  "phonics": MdTextFields,
  "model-answer": MdFactCheck,
  "quiz": MdHelp,
  "cpd-slideshow": MdDesktopMac,
  "letter-writer": MdEmail,
  "performance-management": MdAccessTime,
  "meeting-planner": MdDateRange,
  "lesson-observation": MdVisibility,
  "learning-walk": MdTrendingUp,
  "inspection-prep": MdSearch,
  "eyfs-action-plan": MdAssignmentTurnedIn,
  "ect-report": MdDescription,
  "behaviour-support-plan": MdPlaylistAdd,
  "risk-assessment": MdWarning,
  "one-page-profile": MdBadge,
  "sip": MdShowChart,
  "newsletter": MdNewspaper,
  "assembly": MdGroups,
  "pupil-premium": MdBarChart,
  "policy": MdSecurity,
  "smart-targets": MdTrackChanges,
  "report": MdSummarize,
};

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = TOOL_ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

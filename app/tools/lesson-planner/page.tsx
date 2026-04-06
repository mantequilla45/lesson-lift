import { MdCalendarMonth } from "react-icons/md";
import LessonPlannerForm from "@/app/components/LessonPlannerForm";
import Card from "@/app/components/ui/Card";

const STEPS = [
  {
    label: "Enter key details",
    detail: "Add the year group, subject, topic, and learning objective.",
    color: "bg-yellow-400",
  },
  {
    label: "Add extra guidance",
    detail: "Optionally include a pedagogical theory or exam specification.",
    optional: true,
    color: "bg-green-500",
  },
  {
    label: "Generate your plan",
    detail: "The tool creates a complete lesson outline with objectives, activities, resources, and assessments.",
    color: "bg-orange-400",
  },
  {
    label: "Review and refine",
    detail: "Edit or expand the plan to suit your classroom needs.",
    color: "bg-blue-500",
  },
];

function Sidebar() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="p-6 rounded-2xl bg-blue-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shrink-0">
            <MdCalendarMonth className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold">Lesson plan</h1>
        </div>
        <p className="text-sm font-light">
          Use this tool to design effective lesson plans in minutes. Just add the class level,
          subject, topic, and what you want students to learn. You can also mention a teaching
          style or curriculum focus, and the tool will adapt the content to match your classroom goals.
        </p>
      </div>
      <div className="h-px bg-gray-100" />
      <div className="p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-5">How to use it</h2>
        <ol className="space-y-0">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={`w-7 h-7 rounded-full ${step.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && <div className="w-px grow bg-gray-200 my-1.5" />}
              </div>
              <div className="pb-5">
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  {step.label}
                  {step.optional && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

export default function LessonPlannerPage() {
  return <LessonPlannerForm sidebar={<Sidebar />} />;
}

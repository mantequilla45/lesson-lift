"use client";

import { usePathname } from "next/navigation";
import Card from "@/app/components/ui/Card";
import { ToolTile } from "@/app/components/v2/Squircle";
import { v2ToolForSlug, toolSolid } from "@/app/lib/tools";

interface Step {
  label: string;
  detail: string;
  optional?: boolean;
}

interface ToolInfoPanelProps {
  /** Fallback only, for a pathname that does not resolve to a known tool. */
  icon?: React.ReactNode;
  title: string;
  description: string;
  steps: Step[];
}

// The step numbers walk down the brand rather than through four unrelated
// hues. Purple first, because step one is where the eye lands.
const STEP_COLORS = [
  "bg-(--j-purple)",
  "bg-(--j-mid)",
  "bg-(--j-lilac-2)",
  "bg-(--j-lilac)",
];

export default function ToolInfoPanel({
  icon,
  title,
  description,
  steps,
}: ToolInfoPanelProps) {
  const pathname = usePathname();
  // The slug, not the href: v2ToolForSlug is keyed by the /tools/<slug> segment.
  const slug = pathname.split("/")[2] ?? "";
  const tool = v2ToolForSlug(slug);

  return (
    <Card className="overflow-hidden p-0">
      {/* The hero tint is the brand's, not a per-page prop. Each page used to
          pass its own `heroBg`, which is how two pages ended up violet and one
          blue for no reason a teacher could see. */}
      <div className="p-5 sm:p-6 rounded-2xl bg-(--j-tint)">
        <div className="flex items-center gap-3 mb-4">
          {tool ? (
            <ToolTile icon={tool.icon} solid={toolSolid(tool)} size="lg" />
          ) : (
            <div className="w-11 h-11 bg-(--j-card) rounded-xl flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold min-w-0 text-(--j-ink)">{title}</h1>
        </div>
        <p className="text-sm font-light text-(--j-body)">{description}</p>
      </div>
      <div className="pt-5 pb-6 px-5 sm:px-8">
        <div className="h-px bg-gray-200 mb-5" />
        <h2 className="text-md font-semibold text-gray-900 mb-5">How to use it</h2>
        <ol className="space-y-0">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={`w-7 h-7 rounded-full ${STEP_COLORS[i % STEP_COLORS.length]} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                  {i + 1}
                </span>
                {i < steps.length - 1 && <div className="w-px grow bg-gray-200 my-1.5" />}
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

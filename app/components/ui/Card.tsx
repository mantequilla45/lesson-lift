import { cn } from "@/app/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// The panel every tool form, and most of the signed-in app, is built out of.
// One line here reaches all 35 tool pages, so the V2 card surface is set once:
// white on a tinted page, with a hairline to separate the two.
export default function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={cn(
        "bg-(--j-card) border border-(--j-line) rounded-3xl p-5 sm:p-6 lg:p-8",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

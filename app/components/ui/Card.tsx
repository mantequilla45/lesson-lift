import { cn } from "@/app/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={cn("bg-[#FAF9F5] rounded-3xl p-5 sm:p-6 lg:p-8", className)}
      style={style}
    >
      {children}
    </div>
  );
}

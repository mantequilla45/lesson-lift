"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BiSolidDashboard } from "react-icons/bi";
import { FaPenNib } from "react-icons/fa";
import { RiFolder6Fill } from "react-icons/ri";
import { MdAssistant } from "react-icons/md";

const NAV = [
  { label: "Dashboard", icon: BiSolidDashboard, href: "#" },
  { label: "Tools", icon: FaPenNib, href: "/" },
  { label: "Folders", icon: RiFolder6Fill, href: "#" },
  { label: "AI assistant", icon: MdAssistant, href: "#" },
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-screen sticky top-0 px-6 py-8"
      style={{ borderRight: "1px solid #DAD8D0" }}
    >
      <div className="flex items-center justify-between mb-10">
        <span className="text-xl font-extrabold" style={{ color: "#4a4a4a" }}>Lesson Lift</span>
        <button className="p-2 border border-line rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted" />
        </button>
      </div>

      <nav className="space-y-1 grow">
        {NAV.map(({ label, icon: Icon, href }) => {
          const active = href === "/" ? (pathname === "/" || pathname.startsWith("/tools")) : pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${active ? "bg-[#1a1a1a] text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

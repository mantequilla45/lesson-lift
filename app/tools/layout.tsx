import Link from "next/link";
import { User } from "lucide-react";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">
              Lesson Lift
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">My Content</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Tools</a>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>Teacher Pro</span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

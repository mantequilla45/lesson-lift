import ComprehensionForm from "./components/ComprehensionForm";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F8F8] font-sans">
      {/* Header */}
      <header className="bg-white bold-border border-t-0 border-x-0 sticky top-0 z-50">
        <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <span className="text-2xl font-black tracking-tighter" style={{ fontFamily: "var(--font-headline)" }}>
              ComprehendAI
            </span>
            <div className="hidden md:flex gap-8">
              {["Dashboard", "My Texts", "Curriculum"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="font-black text-sm uppercase tracking-tight hover:text-[#FFCC33] transition-colors"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-4 border-l-2 border-[#1C1B1B] pl-6">
              <UserIcon className="w-5 h-5" />
              <span className="font-bold text-sm">Teacher Pro</span>
            </div>
            <button
              className="bg-[#FFCC33] bold-border px-4 py-2 font-black text-sm uppercase neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              Settings
            </button>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12 md:px-12">
        <div className="mb-12 text-center md:text-left">
          <h1
            className="text-5xl md:text-6xl font-black tracking-tighter mb-4"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Comprehension <span className="scribble-highlight">Generator</span>
          </h1>
          <p className="text-xl font-medium max-w-2xl text-[#1C1B1B]/70">
            Create bespoke literacy activities tailored to your students in seconds.
            Structured for teachers, designed for learning.
          </p>
        </div>

        <ComprehensionForm />
      </main>

      {/* Footer */}
      <footer className="bg-[#1C1B1B] text-white border-t-2 border-[#FFCC33] py-12 px-8 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <span
              className="font-black text-[#FFCC33] text-xl tracking-tighter uppercase"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              ComprehendAI
            </span>
            <p className="text-white/50 text-xs mt-2 font-medium">
              © 2025 The Structured Playground for Educators
            </p>
          </div>
          <div className="flex gap-10">
            {["Privacy", "Terms", "Support"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-xs font-black uppercase tracking-widest hover:text-[#FFCC33] transition-colors"
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

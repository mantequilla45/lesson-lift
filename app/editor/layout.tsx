import Link from "next/link";
import { Monitor } from "lucide-react";

// Minimal layout: escapes the SideNav/TopBar in `app/tools/layout.tsx`.
//
// Below `lg` it shows a notice instead of the editor. The slide editor is a
// canvas application — 288-384px fixed drawers, a floating contextual toolbar,
// a filmstrip, all inside `h-screen overflow-hidden` around a fixed-aspect
// canvas. Porting that to a phone is a product project, not a layout pass, and
// a half-working version is worse than an honest one: a teacher could lose
// slides to a control they cannot reach.
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        className="lg:hidden min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 lg:px-10 text-center gap-4"
        style={{ backgroundColor: "#F1EFE3" }}
      >
        <Monitor className="w-10 h-10 text-muted" />
        <h1 className="text-xl font-semibold">The slide editor needs a bigger screen</h1>
        <p className="text-sm text-muted max-w-sm">
          Slideshows are built on a canvas that needs room to work. Open this on a tablet
          or laptop — your slides are saved and waiting.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          Back to dashboard
        </Link>
      </div>

      {/* `contents` rather than a block wrapper: the editor's own h-screen flex
          chain would break if an extra box were introduced between it and the
          body. */}
      <div className="hidden lg:contents">{children}</div>
    </>
  );
}

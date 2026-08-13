// The holding page behind maintenance_mode. Reached by a rewrite from proxy.ts,
// so the teacher keeps the URL they asked for and a refresh puts them straight
// back into the app the moment maintenance is switched off.

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "#F1EFE3" }}
    >
      <div
        className="w-full max-w-md rounded-3xl px-10 py-12 text-center"
        style={{ backgroundColor: "#FAF9F5" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo.svg"
          alt="Jooma"
          className="mx-auto mb-7"
          style={{ height: 34, width: "auto" }}
        />
        <h1 className="text-xl font-bold mb-2.5" style={{ color: "#1a1a1a" }}>
          Back in a moment
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#6b6055" }}>
          We&apos;re making a quick update to Jooma. Nothing you&apos;ve made has been
          affected — your resources will all be here when we&apos;re done.
        </p>
        <p className="text-sm mt-4" style={{ color: "#8a8078" }}>
          Try refreshing in a few minutes.
        </p>
      </div>
    </div>
  );
}

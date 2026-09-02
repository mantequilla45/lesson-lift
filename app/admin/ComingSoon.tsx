// Shared placeholder for admin pages whose sidebar entry exists but whose
// page hasn't been built yet. Swap this out page by page as each ships.
export default function ComingSoon({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#1D1730" }}>
        {title}
      </h1>
      <p className="text-sm mb-6" style={{ color: "#6D6683" }}>
        {blurb ?? "Not built yet."}
      </p>
      <div
        className="rounded-2xl border border-dashed p-10 text-center"
        style={{ borderColor: "#EAE6F5", backgroundColor: "#FFFFFF" }}
      >
        <p className="text-sm font-medium" style={{ color: "#6D6683" }}>
          This section is on the roadmap.
        </p>
      </div>
    </>
  );
}

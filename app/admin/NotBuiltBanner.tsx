// Shown at the top of admin pages for features that exist as screens but are
// not part of the shippable product yet. The sidebar links to these are
// disabled, so a page is normally only reached by typing its URL or following
// a link from the dashboard's needs-attention list — either way the reader
// deserves to know the data on it can't be acted on.
export default function NotBuiltBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3 mb-5 text-sm font-medium flex items-start gap-2"
      style={{ backgroundColor: "#1D1730", color: "#fff" }}
    >
      <span
        className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 mt-0.5"
        style={{ backgroundColor: "#fff", color: "#1D1730" }}
      >
        NOT BUILT YET
      </span>
      <span>{children}</span>
    </div>
  );
}

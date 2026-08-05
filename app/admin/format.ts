// Shared formatters for the admin pages.
export const nf = new Intl.NumberFormat("en-GB");

// USD -> GBP. Costs are logged in USD (token_usage.cost_usd, asset_cost.cost_usd)
// because that's what the model providers bill in, but Jooma sells in GBP and
// every figure in this console is read as GBP. This is the single place to
// change the rate.
export const FX_USD_TO_GBP = 0.79;

export const usd = (n: number) => {
  const v = Number(n) || 0;
  return v > 0 ? `$${v.toFixed(v < 0.1 ? 4 : 2)}` : "$0.00";
};

/** A GBP amount that is already in GBP. Use `gbpFromUsd` for logged costs. */
export const gbp = (n: number) => {
  const v = Number(n) || 0;
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Convert a logged USD cost to GBP for display. */
export const gbpFromUsd = (n: number) => gbp((Number(n) || 0) * FX_USD_TO_GBP);

/** Sub-£1 amounts read better in pence — 0.9p beats £0.01 for per-run costs. */
export const pence = (n: number) => {
  const v = Number(n) || 0;
  return v < 1 ? `${(v * 100).toFixed(1)}p` : gbp(v);
};

/** Sub-£1 logged USD cost, shown in pence. */
export const penceFromUsd = (n: number) => pence((Number(n) || 0) * FX_USD_TO_GBP);

export const pct = (n: number, digits = 0) => `${(Number(n) * 100).toFixed(digits)}%`;

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** "2h ago" / "3d ago" / "never" — matches the mockup's `last` column. */
export const fmtRelative = (iso: string | null) => {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
};

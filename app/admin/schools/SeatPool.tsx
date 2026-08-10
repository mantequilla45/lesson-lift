"use client";

import { C } from "../ui";

// The seat-pool visualisation: one square per contracted seat, coloured by
// status. Dormant and unassigned seats are the renewal risk — a school that
// bought 30 seats and uses 11 will not renew at 30, and this makes that
// visible at a glance rather than buried in a percentage.

const SEAT: Record<string, React.CSSProperties> = {
  assigned: { backgroundColor: C.ink, borderColor: C.ink },
  dormant: { backgroundColor: C.warnBg, borderColor: C.warn },
  invited: { backgroundColor: C.divider, borderColor: C.ink, borderStyle: "dashed" },
  free: { backgroundColor: C.divider, borderColor: C.border },
};

export function SeatPool({
  assigned,
  invited,
  dormant,
  free,
  max = 120,
}: {
  assigned: number;
  invited: number;
  dormant: number;
  free: number;
  /** Above this many seats, squares stop being legible — show a bar instead. */
  max?: number;
}) {
  const total = assigned + invited + dormant + free;

  if (total === 0) {
    return (
      <span className="text-xs" style={{ color: C.muted }}>
        No seats
      </span>
    );
  }

  // Large schools get a proportional bar rather than 200 unreadable squares.
  if (total > max) {
    const seg = (n: number, style: React.CSSProperties) =>
      n > 0 ? <div style={{ ...style, width: `${(n / total) * 100}%` }} /> : null;
    return (
      <div className="flex h-2 rounded overflow-hidden w-full min-w-[120px]" title={`${total} seats`}>
        {seg(assigned, { backgroundColor: C.ink })}
        {seg(dormant, { backgroundColor: C.warn })}
        {seg(invited, { backgroundColor: C.muted })}
        {seg(free, { backgroundColor: C.border })}
      </div>
    );
  }

  const squares: React.ReactNode[] = [];
  const push = (n: number, kind: keyof typeof SEAT, label: string) => {
    for (let i = 0; i < n; i++) {
      squares.push(
        <span
          key={`${kind}-${i}`}
          title={label}
          className="w-[15px] h-[15px] rounded border"
          style={SEAT[kind]}
        />,
      );
    }
  };

  push(assigned, "assigned", "Assigned and active");
  push(dormant, "dormant", "Assigned but dormant 30+ days");
  push(invited, "invited", "Invited, not accepted");
  push(free, "free", "Unassigned");

  return <div className="flex flex-wrap gap-1">{squares}</div>;
}

export function SeatLegend() {
  const items: [string, React.CSSProperties][] = [
    ["Assigned and active", SEAT.assigned],
    ["Assigned but dormant 30+ days", SEAT.dormant],
    ["Invited, not accepted", SEAT.invited],
    ["Unassigned", SEAT.free],
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs" style={{ color: C.ink2 }}>
      {items.map(([label, style]) => (
        <span key={label} className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm border inline-block" style={style} />
          {label}
        </span>
      ))}
    </div>
  );
}

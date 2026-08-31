import { createElement } from "react";
import * as Phosphor from "@phosphor-icons/react/dist/ssr";

/**
 * A badge medallion, drawn rather than shipped as an image file.
 *
 * Generated SVG for two reasons: it is crisp at any size, from the 74px strip
 * here to a full badge page, and it recolours with the brand instead of needing
 * 100 assets re-exported whenever a tier's palette moves.
 *
 * Five metal tiers, plus a locked state that keeps the shape and drops the
 * colour, so an unearned badge reads as "not yet" rather than as absence.
 */
export type BadgeTier = "bronze" | "silver" | "gold" | "sapphire" | "amethyst";

const TIERS: Record<BadgeTier, { a: string; b: string; c: string; in1: string; in2: string; ring: string }> = {
  bronze: { a: "#E0A868", b: "#B0763A", c: "#8A5527", in1: "#FBEAD3", in2: "#EFCFA4", ring: "#7A4A21" },
  silver: { a: "#E6E9F0", b: "#B6BAC6", c: "#8A8E9C", in1: "#FCFDFF", in2: "#DFE3EC", ring: "#7C808E" },
  gold: { a: "#F5D67A", b: "#DDA92B", c: "#A97A11", in1: "#FDF4D8", in2: "#F4E0A2", ring: "#96690B" },
  sapphire: { a: "#7FAEF0", b: "#3C6FD4", c: "#1E4796", in1: "#E4EDFC", in2: "#BDD2F6", ring: "#173C82" },
  amethyst: { a: "#B98BEE", b: "#7C4BE0", c: "#4A22B5", in1: "#F0E7FC", in2: "#DCC9F7", ring: "#3E1C9B" },
};

const LOCKED = {
  a: "#E7E4EF",
  b: "#D2CDDF",
  c: "#BDB7CC",
  in1: "#F6F4FA",
  in2: "#EAE6F2",
  ring: "#C6C0D4",
};

/** The scalloped medal edge: alternating outer and inner radii around a circle. */
function scallopPath(cx: number, cy: number, R: number, r: number, n: number) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? R : r;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

function pascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** A Phosphor icon renders its own <svg>, so it can be positioned inside this
 *  one with x/y/width/height like any nested SVG element. */
type GlyphComponent = React.ComponentType<{
  weight?: "fill";
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  color?: string;
}>;

const REGISTRY = Phosphor as unknown as Record<string, GlyphComponent | undefined>;

/** Resolved at module scope, not during render. See the note in Squircle.tsx. */
function glyphFor(name: string): GlyphComponent {
  return REGISTRY[pascal(name)] ?? REGISTRY.Medal!;
}

export default function BadgeMedallion({
  icon,
  tier,
  locked = false,
  uid,
}: {
  icon: string;
  tier: BadgeTier;
  locked?: boolean;
  /** Makes the gradient ids unique. Two medallions on one page otherwise share
      a gradient and the second silently inherits the first one's colours. */
  uid: string;
}) {
  const t = locked ? LOCKED : TIERS[tier];

  return (
    <svg viewBox="0 0 100 108" aria-hidden="true">
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={t.a} />
          <stop offset="0.5" stopColor={t.b} />
          <stop offset="1" stopColor={t.c} />
        </linearGradient>
        <linearGradient id={`bi${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={t.in1} />
          <stop offset="1" stopColor={t.in2} />
        </linearGradient>
        <linearGradient id={`bs${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ribbon tails, behind the medal. */}
      <path d="M34 74 L26 104 L40 96 L50 106 L50 74Z" fill={t.c} />
      <path d="M66 74 L74 104 L60 96 L50 106 L50 74Z" fill={t.b} />

      <path d={scallopPath(50, 48, 46, 41, 16)} fill={`url(#bg${uid})`} />
      <circle cx="50" cy="48" r="38" fill={t.ring} opacity="0.35" />
      <circle cx="50" cy="48" r="35" fill={`url(#bi${uid})`} />
      <circle cx="50" cy="48" r="35" fill="none" stroke={t.ring} strokeOpacity="0.4" strokeWidth="1.5" />

      {createElement(glyphFor(icon), {
        weight: "fill",
        x: 34,
        y: 32,
        width: 32,
        height: 32,
        color: t.c,
      })}

      {/* Gloss across the top half, so the disc reads as struck metal. */}
      <path d="M50 13 A35 35 0 0 1 85 48 A35 35 0 0 0 50 30 A35 35 0 0 0 15 48 A35 35 0 0 1 50 13Z" fill={`url(#bs${uid})`} />
    </svg>
  );
}

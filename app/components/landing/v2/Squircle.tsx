import { createElement } from "react";
import * as Phosphor from "@phosphor-icons/react/dist/ssr";
import styles from "./Squircle.module.css";

/**
 * The one superellipse definition for the page.
 *
 * Tool icons sit on a squircle, not a rounded rectangle. Because it is declared
 * with `clipPathUnits="objectBoundingBox"` the same path clips a 24px tab icon
 * and a 58px header tile without being redefined per size.
 *
 * `clip-path: url(#jsq)` resolves against the current document, so this has to
 * render on the page itself. Putting it in a layout that the page does not
 * share would leave every tile unclipped and square.
 */
export function SquircleDefs() {
  return (
    <svg width="0" height="0" className={styles.defs} aria-hidden="true">
      <defs>
        <clipPath id="jsq" clipPathUnits="objectBoundingBox">
          <path d="M0,0.5 C0,0.115 0.115,0 0.5,0 C0.885,0 1,0.115 1,0.5 C1,0.885 0.885,1 0.5,1 C0.115,1 0,0.885 0,0.5 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Phosphor exports PascalCase components; the data uses kebab-case names. */
function pascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

type IconComponent = React.ComponentType<{ weight?: "fill" | "regular"; className?: string }>;

const REGISTRY = Phosphor as unknown as Record<string, IconComponent | undefined>;

/**
 * Resolve a Phosphor icon by kebab-case name.
 *
 * Called at module scope, never during render: a lookup inside the component
 * hands React a fresh function identity every time, so it unmounts and
 * remounts the icon rather than updating it. Falls back to a neutral glyph
 * rather than rendering nothing, so a name that does not exist looks wrong in
 * review instead of leaving a silently empty tile in production.
 */
function iconFor(name: string): IconComponent {
  return REGISTRY[pascal(name)] ?? REGISTRY.Square!;
}

/**
 * A tool icon on its coloured squircle.
 *
 * The glyph is sized by a percentage on the tile, never by a class on the SVG
 * itself: a size utility landing on the icon beats the container rule and
 * pushes the glyph out of the middle of its tile.
 *
 * `fill` weight is correct inside a tile. Regular weight is for interface
 * chrome, which is not what this is.
 */
export function ToolTile({
  icon,
  solid,
  size = "md",
}: {
  icon: string;
  solid: string;
  /** Tile sizes are tokens. `tab` is the small inline tile in the demo tabs. */
  size?: "sm" | "md" | "lg" | "tab";
}) {
  return (
    <span
      className={`${styles.tile} ${styles[size]}`}
      style={{ background: solid }}
      aria-hidden="true"
    >
      {createElement(iconFor(icon), { weight: "fill", className: styles.glyph })}
    </span>
  );
}

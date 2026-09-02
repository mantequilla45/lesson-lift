import { PencilSimple } from "@phosphor-icons/react/dist/ssr";

/**
 * Marks a form Jo filled in.
 *
 * Matters for trust as much as for information: the teacher needs to see at a
 * glance that these values were inferred from a sentence and are theirs to
 * correct, not settings they chose. The pencil says "editable", which is the
 * whole point. No sparkle: the brand bible bans them.
 */
export default function PrefilledBadge() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold w-fit"
      style={{ backgroundColor: "var(--j-tint)", color: "var(--j-deep)" }}
    >
      <PencilSimple className="w-3 h-3" />
      Filled in from your request. Check it before you build.
    </div>
  );
}

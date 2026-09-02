// The message panel only.
//
// The chrome and the chat sidebar live in app/assistant/layout.tsx now, so they
// are already on screen and stay mounted across navigation. Drawing them here
// too would paint a skeleton sidebar over the real one every time a teacher
// clicks a chat — the flicker this route was changed to remove.
export default function Loading() {
  return (
    <section
      className="flex flex-1 flex-col overflow-hidden rounded-2xl"
      style={{ backgroundColor: "var(--j-card)" }}
    />
  );
}

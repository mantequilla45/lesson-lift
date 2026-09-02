import AssistantShell from "@/app/components/assistant/AssistantShell";

/**
 * Wraps /assistant and /assistant/[id] so the chrome and the chat list survive
 * navigation between them — partial rendering, per
 * docs/instant-navigation-guide.md section 3. The state itself is client-side,
 * so this stays a thin wrapper around AssistantShell.
 */
export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AssistantShell>{children}</AssistantShell>;
}

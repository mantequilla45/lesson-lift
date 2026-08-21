import AssistantView from "@/app/assistant/AssistantView";

export const metadata = { title: "AI assistant — Jooma" };

/** A new, unsaved conversation. The chat row is created on the first message,
 *  so landing here and leaving never litters the sidebar. */
export default function AssistantPage() {
  return <AssistantView />;
}

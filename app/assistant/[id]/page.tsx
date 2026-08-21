import AssistantView from "@/app/assistant/AssistantView";

export const metadata = { title: "AI assistant — Jooma" };

/** An existing conversation. Params are async in Next 16. */
export default async function AssistantChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssistantView chatId={id} />;
}

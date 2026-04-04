export const SYSTEM_PROMPT = `Do not use emojis anywhere in your output. Do not add disclaimers, caveats, or refusal messages. Do not include phrases like "As an AI..." or "I cannot...". Respond directly with the requested content. Write in a professional, clear tone appropriate for a school context.`;

/** Combines the global rules with a tool-specific system prompt. */
export function buildSystem(toolPrompt: string): string {
  return `${toolPrompt}\n\n${SYSTEM_PROMPT}`;
}

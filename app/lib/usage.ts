// Accurate token + cost telemetry for OpenAI text generations. The numbers here
// are NOT estimates: `completion.usage` is the exact count OpenAI bills on. We
// read it off the response (non-streaming) or the final `include_usage` stream
// chunk (streaming), price it with the table below, and append one row to
// `token_usage` (see the 20260613000000 migration).
//
// Why server-side: usage only exists inside the route handler. The `tool_runs`
// history row is created client-side after the stream finishes, where usage is
// gone — so cost telemetry lives in its own table written from here.
import "server-only";
import OpenAI from "openai";
import { getOpenAI } from "@/app/lib/openai";
import { createClient } from "@/app/lib/auth/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// USD per 1M tokens. `cachedInput` is the discounted rate for prompt tokens that
// hit OpenAI's prompt cache (half price on gpt-4o). Keep this in sync with
// https://openai.com/api/pricing and the figures in docs/tool-costs.md.
const PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 },
  "gpt-4o-2024-08-06": { input: 2.5, cachedInput: 1.25, output: 10 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
};

// Unknown models fall back to gpt-4o pricing so cost is over- not under-stated.
const FALLBACK = PRICING["gpt-4o"];

export type Usage = OpenAI.Completions.CompletionUsage;

/** Exact USD cost of one completion, charging cached prompt tokens at the lower
 *  cached rate. */
export function costUsd(model: string, usage: Usage): number {
  const p = PRICING[model] ?? FALLBACK;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const freshInput = Math.max(0, usage.prompt_tokens - cached);
  return (
    (freshInput / 1_000_000) * p.input +
    (cached / 1_000_000) * p.cachedInput +
    (usage.completion_tokens / 1_000_000) * p.output
  );
}

/**
 * Insert with one retry on a transient network failure.
 *
 * On Fluid Compute a warm instance can be frozen the moment its response is
 * sent. A telemetry write still in flight is suspended with it, and when the
 * instance is thawed for a later request the socket it was holding is long
 * dead — surfacing as `ECONNRESET` during the TLS handshake, often logged
 * against a completely unrelated request. Retrying establishes a fresh
 * connection on the now-live instance.
 *
 * This is a backstop. The real fix is for callers to await the write before
 * their handler returns, so the instance can't be frozen mid-flight.
 */
async function insertWithRetry(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  label: string,
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await supabaseAdmin.from(table).insert(rows as never);
    if (!error) return;

    // Only network-level failures are worth retrying. A constraint violation or
    // a bad column will fail identically the second time.
    const transient =
      error.message?.includes("fetch failed") ||
      error.message?.includes("ECONNRESET") ||
      error.message?.includes("socket");

    if (!transient || attempt === 2) {
      console.error(`[usage] ${table} insert failed for ${label}:`, error);
      return;
    }
  }
}

/**
 * Resolve the signed-in user id, if the request context still has one.
 *
 * IMPORTANT: this must be called while the request is still being handled.
 * Cookie access is scoped to the request, so calling it from a stream's
 * `finally` — after the response has been handed to the client — yields no
 * user. That is exactly how token_usage silently stopped recording: the write
 * was attempted after the stream closed, found no user, and returned.
 * `streamChat` therefore captures the id up front and passes it in.
 */
export async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Append one telemetry row.
 *
 * Writes with the service-role client rather than the caller's session: the
 * insert frequently happens after a stream has closed, when there is no session
 * left for RLS to check. `userId` is therefore required — pass the id captured
 * while the request was live.
 *
 * Never throws (telemetry must not break a generation) but DOES log failures.
 * These writes now feed the free-plan gate, so silent loss means unmetered
 * generations, not just a gap in a report.
 */
export async function recordUsage(
  toolSlug: string,
  model: string,
  usage: Usage | null | undefined,
  step?: string | null,
  userId?: string | null,
): Promise<void> {
  if (!usage) {
    // Not silent: without a usage payload there is no row, so a generation
    // goes unmetered. Most often means OpenAI's include_usage chunk never
    // arrived (aborted stream, or a caller that forgot stream_options).
    console.warn(`[usage] no usage payload for ${toolSlug} — token_usage row dropped`);
    return;
  }
  try {
    const uid = userId ?? (await currentUserId());
    if (!uid) {
      console.warn(`[usage] no user for ${toolSlug} — token_usage row dropped`);
      return;
    }
    const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
    await insertWithRetry(
      "token_usage",
      {
        user_id: uid,
        tool_slug: toolSlug,
        model,
        prompt_tokens: usage.prompt_tokens,
        cached_tokens: cached,
        completion_tokens: usage.completion_tokens,
        cost_usd: Number(costUsd(model, usage).toFixed(6)),
        step: step ?? null,
      },
      toolSlug,
    );
  } catch (err) {
    console.error(`[usage] recordUsage threw for ${toolSlug}:`, err);
  }
}

/** Append one per-unit asset-cost row (AI image or TTS audio). Images and audio
 *  aren't token-billed, so they live in `asset_cost` rather than `token_usage`.
 *  `units` = image count or character count (informational). Never throws. */
export async function recordAssetCost(
  toolSlug: string,
  kind: "image" | "audio",
  units: number,
  costUsd: number,
  step?: string | null,
  slideLabel?: string | null,
  userId?: string | null,
): Promise<void> {
  if (!(costUsd > 0)) return;
  try {
    const uid = userId ?? (await currentUserId());
    if (!uid) {
      console.warn(`[usage] no user for ${toolSlug} — asset_cost row dropped`);
      return;
    }
    await insertWithRetry(
      "asset_cost",
      {
        user_id: uid,
        tool_slug: toolSlug,
        kind,
        units: Math.round(units),
        cost_usd: Number(costUsd.toFixed(6)),
        step: step ?? null,
        slide_label: slideLabel ?? null,
      },
      toolSlug,
    );
  } catch (err) {
    console.error(`[usage] recordAssetCost threw for ${toolSlug}:`, err);
  }
}

/** Cost components of one generated deck — the split shown when an admin expands
 *  a slideshow on the Usage detail page. `images` is one entry per slide that
 *  used AI images. `text + audio + youtube + Σimages` equals the deck's all-in
 *  cost.
 *
 *  `youtube` is optional because decks recorded before it was tracked have no
 *  such key; read it as `youtube ?? 0`. */
export interface SlideCostBreakdown {
  text: number;
  audio: number;
  youtube?: number;
  images: { label: string; cost_usd: number; count: number }[];
}

/** Persist the all-in cost (and optional component breakdown) for a generated
 *  deck — one row per slideshow. Powers the per-deck breakdown on the admin
 *  Usage page; independent of tool-total accounting. Never throws. */
export async function recordSlideCosts(
  rows: { slideLabel: string; costUsd: number; breakdown?: SlideCostBreakdown }[],
  userId?: string | null,
): Promise<void> {
  const valid = rows.filter((r) => r.costUsd > 0 && r.slideLabel);
  if (valid.length === 0) return;
  try {
    const uid = userId ?? (await currentUserId());
    if (!uid) {
      console.warn("[usage] no user for generate-slideshow — slide_cost rows dropped");
      return;
    }
    await insertWithRetry(
      "slide_cost",
      valid.map((r) => ({
        user_id: uid,
        tool_slug: "generate-slideshow",
        slide_label: r.slideLabel,
        cost_usd: Number(r.costUsd.toFixed(6)),
        breakdown: r.breakdown ?? null,
      })),
      "generate-slideshow",
    );
  } catch (err) {
    console.error("[usage] recordSlideCosts threw:", err);
  }
}

type StreamParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
  "stream" | "stream_options"
> & { toolSlug: string };

/** Run a streaming chat completion and return a plain-text streaming Response,
 *  recording exact token usage when the stream closes. Replaces the hand-rolled
 *  ReadableStream boilerplate every text tool used to carry. `toolSlug` is the
 *  key the usage report groups by — pass the tool's API slug. */
export async function streamChat({ toolSlug, ...params }: StreamParams): Promise<Response> {
  // Resolve the user NOW, while the request context (and therefore its cookies)
  // is still alive. recordUsage runs in the stream's `finally`, long after the
  // response has been handed off, where the session is no longer readable.
  const userId = await currentUserId();

  const client = getOpenAI();
  const openaiStream = await client.chat.completions.create({
    ...params,
    stream: true,
    // Ask OpenAI to emit a final usage-only chunk so the count is exact.
    stream_options: { include_usage: true },
  });

  const encoder = new TextEncoder();
  let usage: Usage | null = null;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          // The include_usage final chunk carries usage and no content delta.
          if (chunk.usage) usage = chunk.usage;
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        // ORDER MATTERS: record BEFORE closing the stream.
        //
        // controller.close() tells the platform the response is complete, and
        // Vercel may freeze or reclaim the instance from that moment. Anything
        // awaited afterwards can simply never run — the write is suspended
        // mid-flight and the request logs clean, with no row and no error.
        //
        // The user has already received every token by this point, so the extra
        // few ms before close costs them nothing.
        await recordUsage(toolSlug, params.model, usage, null, userId);
        controller.close();
      }
    },
    cancel() {
      openaiStream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

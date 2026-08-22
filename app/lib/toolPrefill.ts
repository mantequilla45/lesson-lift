// Encoding and validation for the `?prefill=` payload the assistant hands to a
// tool page.
//
// Shared by both ends: the assistant route encodes, the tool page decodes. It is
// isomorphic (no server-only import) because both sides need it.
//
// TREAT THE PAYLOAD AS HOSTILE. It arrives in a URL, so anyone can hand-edit it,
// and it is fed straight into form state. Validation is therefore allow-list
// only: unknown tools are rejected, unknown fields are dropped, enums must
// match exactly, and strings are length-capped. Anything that fails validation
// yields null and the form opens empty — never a crash, never half-filled.
import { assistantToolFor } from "@/app/lib/assistant-tools";

/** What the assistant decided, and what the tool page consumes. */
export interface ToolPrefill {
  slug: string;
  fields: Record<string, string | number | boolean | string[]>;
}

/** Cap on any prefilled string. Comfortably above a real learning objective,
 *  well below anything that would bloat the URL or a form control. */
const MAX_STRING = 600;

/** Cap on the encoded payload, checked before we bother parsing it. */
const MAX_PAYLOAD = 8_000;

/** Cap on an open-ended array field, for schemas whose items are not an enum. */
const MAX_ARRAY = 50;

/**
 * Base64url, so the payload survives a URL without percent-encoding soup.
 *
 * Uses TextEncoder/TextDecoder rather than raw btoa/atob because the fields
 * carry teacher-written text: btoa throws on any character above U+00FF, and a
 * curly quote or an accented name would be enough to break it.
 */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Encode a validated prefill for use as a `?prefill=` value. */
export function encodePrefill(prefill: ToolPrefill): string {
  return toBase64Url(JSON.stringify(prefill));
}

/**
 * Validate a raw `{ slug, fields }` against the tool's schema.
 *
 * Returns null if the tool is unknown, if no field survives, or if a required
 * field is missing — an empty or partial form is worse than none, because it
 * looks like the assistant understood when it did not.
 *
 * Exported separately from decodePrefill so the assistant route can validate
 * the model's output before ever building a URL.
 */
export function validatePrefill(raw: unknown): ToolPrefill | null {
  if (!raw || typeof raw !== "object") return null;
  const { slug, fields } = raw as { slug?: unknown; fields?: unknown };

  if (typeof slug !== "string") return null;
  const tool = assistantToolFor(slug);
  if (!tool) return null; // not a wired tool — never open it
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;

  const schema = tool.fields as {
    properties: Record<string, {
      type?: string;
      enum?: readonly unknown[];
      minimum?: number;
      maximum?: number;
      items?: { type?: string; enum?: readonly unknown[] };
    }>;
    required?: string[];
  };

  const clean: Record<string, string | number | boolean | string[]> = {};

  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    const spec = schema.properties[key];
    if (!spec) continue; // unknown field — drop it rather than pass it through

    if (spec.type === "string") {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      // An enum is a closed set; anything outside it would not match a <select>
      // option anyway and would render as an empty control.
      if (spec.enum && !spec.enum.includes(trimmed)) continue;
      clean[key] = trimmed.slice(0, MAX_STRING);
      continue;
    }

    if (spec.type === "integer" || spec.type === "number") {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) continue;
      const rounded = spec.type === "integer" ? Math.round(n) : n;
      if (spec.minimum !== undefined && rounded < spec.minimum) continue;
      if (spec.maximum !== undefined && rounded > spec.maximum) continue;
      clean[key] = rounded;
      continue;
    }

    if (spec.type === "boolean") {
      if (typeof value !== "boolean") continue;
      clean[key] = value;
      continue;
    }

    // Arrays of enum strings (differentiationLevels, questionTypes,
    // contentDomains). Same allow-list discipline as the scalar branches: keep
    // only recognised members, and skip the field entirely if none survive
    // rather than handing the form an empty multi-select it will render as
    // "nothing chosen" while claiming to have been prefilled.
    if (spec.type === "array") {
      if (!Array.isArray(value)) continue;
      const allowed = spec.items?.enum;
      const seen = new Set<string>();
      for (const item of value) {
        if (typeof item !== "string") continue;
        const trimmed = item.trim();
        if (!trimmed) continue;
        if (allowed && !allowed.includes(trimmed)) continue;
        seen.add(trimmed.slice(0, MAX_STRING));
      }
      if (seen.size === 0) continue;
      // Cap at the option count when the schema is closed, so a hand-edited URL
      // cannot pad the array with repeats of a valid value.
      const items = [...seen];
      clean[key] = allowed ? items.slice(0, allowed.length) : items.slice(0, MAX_ARRAY);
    }
  }

  if (Object.keys(clean).length === 0) return null;

  // A prefill missing a required field would open a form the teacher still has
  // to complete, having been told it was filled in. Better to answer in chat.
  const required = schema.required ?? [];
  if (required.some((f) => clean[f] === undefined)) return null;

  return { slug, fields: clean };
}

/**
 * Decode and validate a `?prefill=` value.
 *
 * Never throws: malformed base64, invalid JSON and schema violations all return
 * null, and the caller opens an empty form.
 */
export function decodePrefill(raw: string | null | undefined): ToolPrefill | null {
  if (!raw || raw.length > MAX_PAYLOAD) return null;
  try {
    return validatePrefill(JSON.parse(fromBase64Url(raw)));
  } catch {
    return null;
  }
}

/** The URL the ToolLinkCard points at. */
export function prefillHref(prefill: ToolPrefill): string {
  return `/tools/${prefill.slug}?prefill=${encodePrefill(prefill)}`;
}

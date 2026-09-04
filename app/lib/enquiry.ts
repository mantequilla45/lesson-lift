// Shared shape for the contact and school enquiry forms.
//
// No "use client" on purpose: this is imported by the public page (a server
// component), the API route, and the two client forms. The same trick as
// app/(app)/profile/sections-shared.ts, and for the same reason — a module with
// the directive would hand the server a client-reference stub instead of the
// arrays.
//
// There is no zod in this repo. Validation is the pair it has always been:
// these predicates in front of the user, and check constraints plus
// submit_enquiry() behind them. The database is the one that gets the last word.

export type EnquiryKind = "contact" | "school";

export const ENQUIRY_KINDS: readonly EnquiryKind[] = ["contact", "school"] as const;

export function asEnquiryKind(v: string | undefined | null): EnquiryKind {
  return v === "school" ? "school" : "contact";
}

/**
 * "Where did you hear about Jooma", with the social channels named separately
 * rather than lumped into one "social media" row: which platform a school came
 * through is the answer that changes where the next month of effort goes, and a
 * single bucket cannot give it.
 *
 * `other` reveals a free-text box. Its value is only stored when `other` is the
 * pick, so the admin pane never shows a stale answer beside a chosen one.
 */
export const HEARD_ABOUT_OPTIONS = [
  { value: "search", label: "Search engine (Google, Bing)" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X" },
  { value: "youtube", label: "YouTube" },
  { value: "colleague", label: "A colleague or friend" },
  { value: "school", label: "My school or trust" },
  { value: "event", label: "Conference or event" },
  { value: "newsletter", label: "Newsletter or blog" },
  { value: "advert", label: "Advertisement" },
  { value: "other", label: "Other" },
] as const;

export const HEARD_ABOUT_OTHER = "other";

/** Label for a stored value, for the admin detail pane. Falls back to the raw
 *  value so a row written before an option was renamed still reads sensibly. */
export function heardAboutLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return HEARD_ABOUT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const ENQUIRY_STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  closed: "Closed",
};

/** Same expression as the check constraint on enquiries.email and the one in
 *  app/api/colleagues/invite/route.ts. Deliberately loose: the only real test
 *  of an address is sending to it. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/**
 * Phone check, kept deliberately permissive.
 *
 * Digits, spaces, and the punctuation international numbers actually carry.
 * A school secretary typing "+44 (0)20 7946 0958 ext 214" is giving a usable
 * number, and a stricter pattern would reject it to no benefit — nobody is
 * dialling this automatically.
 */
export function isPhone(v: string): boolean {
  const trimmed = v.trim();
  if (trimmed.length < 7 || trimmed.length > 40) return false;
  return /^[0-9+()\-.\s]+(?:\s?(?:ext|x)\.?\s?\d{1,6})?$/i.test(trimmed);
}

/** What both forms POST to /api/enquiries. Strings throughout, including
 *  `licences`, because that is what an input gives you. */
export interface EnquiryPayload {
  kind: EnquiryKind;
  name: string;
  email: string;
  phone?: string;
  school?: string;
  licences?: string;
  heard_about?: string;
  heard_other?: string;
  message?: string;
  /** Honeypot. Named for something a bot wants to fill and a human never sees.
   *  A filled value means the request is dropped. */
  company?: string;
}

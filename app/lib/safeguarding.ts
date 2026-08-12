// ── Safeguarding detection ───────────────────────────────────────────────────
//
// WHAT THIS IS FOR.
// Jooma is used by teachers in UK schools. The realistic safeguarding risk is
// not a teacher being abusive to a chatbot — it is a teacher pasting
// identifiable pupil safeguarding content into a prompt, in good faith, to get
// help writing it up. A disclosure of abuse, a self-harm concern, a named child
// with sensitive detail. That content should not be sitting in an OpenAI
// request body, and the school needs to know it was handled. So this reads the
// INPUT, not the output.
//
// WHAT IT IS NOT.
// It does not block. It never delays a generation. It is a review trail, so
// that when a school asks "what happens if one of my staff types something they
// shouldn't into this", the answer is a page with names on it rather than a
// shrug.
//
// ── THE FALSE-POSITIVE PROBLEM, AND THE ANSWER TO IT ──
// Naive keyword matching is useless here and would be actively harmful. This
// product's users write PSHE lessons on bullying, history lessons on the
// Holocaust, RSE schemes of work, safeguarding policies and risk assessments.
// "abuse", "suicide" and "neglect" are ordinary professional vocabulary for a
// secondary teacher. A page full of flagged lesson plans trains an admin to
// ignore the page — which is strictly worse than having no page at all.
//
// So severity is decided by SHAPE, not vocabulary:
//
//   * A concern term ALONE is never a flag.
//   * CURRICULUM CONTEXT ("lesson", "scheme of work", "assembly", "policy",
//     "PSHE", "year 9") suppresses the flag entirely — that is the tool being
//     used exactly as designed.
//   * DISCLOSURE SHAPE — reported speech ("he told me", "she disclosed",
//     "came to me and said") near the term — is the real discriminator. It is
//     what separates "I am writing a lesson about self-harm" from "a child has
//     told me they are self-harming".
//   * A NAMED CHILD alongside a concern term raises severity, because
//     identifiability is the specific problem. It never flags on its own.
//
// Shipped deliberately conservative. It is far easier to loosen this after
// watching a week of real traffic than to win back an admin who stopped reading
// the page because it cried wolf.

/** Severity tiers, mirroring the safeguarding_flags CHECK constraint. */
export type Severity = "low" | "medium" | "high";

/** Hard cap on a stored excerpt, mirroring the `left(..., 300)` in
 *  record_safeguarding_flag(). Enforced in both places on purpose: this table
 *  must never become a second copy of sensitive pupil content. */
export const EXCERPT_MAX = 300;

export interface SafeguardingHit {
  severity: Severity;
  /** Human-readable, shown as the first column a reviewer reads. */
  reason: string;
  /** A short window around the match — never the whole prompt. */
  excerpt: string;
}

// High-concern terms. These only ever flag when something else corroborates.
const TIER_A: { re: RegExp; label: string }[] = [
  { re: /\bself[-\s]?harm(?:ing|ed)?\b/i, label: "self-harm" },
  { re: /\bcutting (?:her|him|them)self\b/i, label: "self-harm" },
  { re: /\bsuicid(?:e|al)\b/i, label: "suicide" },
  { re: /\b(?:kill|harm|hurt) (?:her|him|them)self\b/i, label: "suicide" },
  { re: /\bend (?:her|his|their) (?:own )?life\b/i, label: "suicide" },
  { re: /\bsexual(?:ly)? (?:abuse|assault|touch(?:ed|ing))\b/i, label: "sexual abuse" },
  // The euphemism a child actually uses. Deliberately narrow — it requires a
  // person being touched, so "touched the equipment" or "a touching story"
  // cannot match, and like every Tier A term it still needs disclosure shape or
  // a name before it reaches high severity.
  // "me" is excluded: "the story really touched me" is ordinary English and a
  // teacher is not the safeguarding subject here. A body part after the pronoun
  // ("touched her shoulder") is ordinary classroom description too.
  { re: /\btouch(?:ed|ing) (?:her|him|them)\b(?!\s+(?:shoulder|arm|hand|head|back)\b)/i, label: "inappropriate touching" },
  { re: /\brap(?:e|ed|ing)\b/i, label: "rape" },
  { re: /\bgroom(?:ed|ing)\b/i, label: "grooming" },
  { re: /\bFGM\b/, label: "FGM" },
  { re: /\bfemale genital mutilation\b/i, label: "FGM" },
  { re: /\bchild protection (?:referral|plan|concern)\b/i, label: "child protection referral" },
  { re: /\bMASH referral\b/i, label: "MASH referral" },
  { re: /\bsection 47\b/i, label: "section 47" },
  { re: /\bdomestic (?:violence|abuse)\b/i, label: "domestic abuse" },
  { re: /\bcounty lines\b/i, label: "county lines" },
  { re: /\b(?:radicalisation|radicalized|radicalised|Prevent referral)\b/i, label: "radicalisation" },
  { re: /\b(?:hits?|hitting|beats?|beating|punch(?:ed|es)?) (?:her|him|them|me)\b/i, label: "physical abuse" },
];

// Moderate terms. These flag only alongside disclosure shape.
const TIER_B: { re: RegExp; label: string }[] = [
  { re: /\bneglect(?:ed|ing)?\b/i, label: "neglect" },
  { re: /\bbruis(?:e|es|ing|ed)\b/i, label: "bruising" },
  { re: /\bmalnourish(?:ed|ment)\b/i, label: "malnourishment" },
  { re: /\bsafeguarding concern\b/i, label: "safeguarding concern" },
  { re: /\b(?:DSL|designated safeguarding lead)\b/i, label: "DSL" },
  { re: /\bsocial (?:services|worker)\b/i, label: "social services" },
  { re: /\b(?:looked[-\s]after child|LAC|child in need|CIN)\b/i, label: "looked-after child" },
  { re: /\beating disorder\b/i, label: "eating disorder" },
  { re: /\b(?:running away|ran away|absconded)\b/i, label: "running away" },
  { re: /\bsubstance (?:misuse|abuse)\b/i, label: "substance misuse" },
];

// Reported speech and present-tense concern about a specific person. This is
// what turns professional vocabulary into an apparent disclosure.
const DISCLOSURE =
  /\b(?:told me|said (?:to me|that|her|his|they)|disclosed|confided|came to me|reported that|admitted (?:to me|that)|has been|have been|is being|are being|keeps? being)\b/i;

// Curriculum framing. Its presence means the teacher is producing teaching
// material about a topic, which is the entire point of the product.
//
// A YEAR GROUP IS DELIBERATELY NOT IN THIS LIST. "Year 8" is how a teacher
// identifies a child ("Jamie in Year 8 told me…") at least as often as it
// frames a class, so treating it as curriculum context suppressed the single
// most important case this detector exists to catch. Year groups only ever
// appear in NAMED_CHILD below, where they raise severity instead.
const CURRICULUM =
  /\b(?:lesson|lessons|scheme of work|assembly|curriculum|PSHE|RSE|polic(?:y|ies)|risk assessment|key stage|KS\d|unit of work|learning objective|worksheet|quiz|starter activity|plenary|revision|exam question|newsletter)\b/i;

// A capitalised forename next to a pupil word or year group. Deliberately weak:
// it only ever RAISES severity and never flags by itself, because English
// capitalises plenty of things that are not children.
const NAMED_CHILD =
  /\b(?:pupil|student|child|boy|girl)\s+(?:called\s+)?[A-Z][a-z]{2,}\b|\b[A-Z][a-z]{2,}\s+(?:in|from)\s+(?:year|Year|Y)\s*\d\b/;

/** ±80 characters around a match, collapsed to one line. */
function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 80);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

/**
 * Decide whether a prompt looks like a pupil safeguarding disclosure.
 *
 * Pure and synchronous — a few regexes over a string, measured in microseconds.
 * Returns null for the overwhelming majority of generations.
 */
export function scanForSafeguarding(text: string): SafeguardingHit | null {
  if (!text || text.length < 20) return null;

  const curriculum = CURRICULUM.test(text);
  const disclosure = DISCLOSURE.test(text);
  const named = NAMED_CHILD.test(text);

  const tierA = TIER_A.map((t) => ({ t, m: t.re.exec(text) })).find((x) => x.m);
  const tierB = TIER_B.map((t) => ({ t, m: t.re.exec(text) })).find((x) => x.m);

  if (!tierA && !tierB) return null;

  // Curriculum framing wins outright. A scheme of work about self-harm is the
  // product working, and flagging it would bury the cases that matter.
  if (curriculum) return null;

  const hit = tierA ?? tierB!;
  const match = hit.m!;
  const excerpt = excerptAround(text, match.index, match[0].length);
  const term = hit.t.label;

  if (tierA) {
    if (disclosure) {
      return {
        severity: "high",
        reason: named
          ? `Possible pupil disclosure — "${term}" near reported speech, with an apparent pupil name`
          : `Possible pupil disclosure — "${term}" near reported speech`,
        excerpt,
      };
    }
    if (named) {
      return {
        severity: "medium",
        reason: `"${term}" alongside an apparent pupil name, outside any teaching context`,
        excerpt,
      };
    }
    return {
      severity: "low",
      reason: `"${term}" outside any teaching context — most of these are legitimate work`,
      excerpt,
    };
  }

  // Tier B needs disclosure shape to be worth anyone's attention.
  if (disclosure) {
    return {
      severity: "medium",
      reason: named
        ? `"${term}" near reported speech, with an apparent pupil name`
        : `"${term}" near reported speech`,
      excerpt,
    };
  }

  return null;
}

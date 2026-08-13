// Invite tokens.
//
// An invite is a row in `pending_invites` plus a secret token emailed to the
// teacher as /signup?invite=<token>. The token is the only proof they were
// invited, so it's treated as a bearer credential: generated from a CSPRNG,
// stored only as a SHA-256 hash, and compared by hashing the presented value.
// A leaked database read therefore can't be replayed into a free Pro seat.
import "server-only";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase-admin";

/** How long an invite stays usable. Long enough to survive a school holiday,
 *  short enough that a forwarded link doesn't grant a seat months later. */
export const INVITE_TTL_DAYS = 7;

/** 32 bytes of CSPRNG, base64url. Not a UUID: v4 has only 122 bits and is not
 *  guaranteed to come from a cryptographic source. */
export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
}

export type InviteRow = {
  id: string;
  email: string;
  plan: string;
  expires_at: string;
  accepted_at: string | null;
};

export type InviteLookup =
  | { ok: true; invite: InviteRow }
  | { ok: false; reason: "invalid" | "expired" | "accepted" };

/**
 * Resolve a raw token to its invite, rejecting anything not currently usable.
 *
 * Every consumer must go through this rather than trusting a token — or worse,
 * an email — supplied by the client. `/signup?invite=` is attacker-controlled,
 * so without a server-side check anyone could self-assign the Pro plan just by
 * guessing the query parameter's shape.
 */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!token) return { ok: false, reason: "invalid" };

  const { data, error } = await supabaseAdmin
    .from("pending_invites")
    .select("id, email, plan, expires_at, accepted_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "invalid" };
  if (data.accepted_at) return { ok: false, reason: "accepted" };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, invite: data as InviteRow };
}

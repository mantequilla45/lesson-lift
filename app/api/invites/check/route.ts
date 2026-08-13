import { NextRequest, NextResponse } from "next/server";
import { lookupInvite } from "@/app/lib/invites";

// Resolves an invite token to the address it was sent to, so /signup can show
// "You've been invited as <email>" and lock the field.
//
// Display only — accepting an invite goes through /api/invites/accept, which
// re-verifies the token itself. Nothing here is load-bearing for access: a
// forged token gets `valid: false`, and a real one reveals only the address the
// holder of the link was already emailed at.
//
// The plan is deliberately NOT returned. An admin's choice of plan isn't the
// teacher's business until it's applied, and echoing it here would invite a
// client that reads it and sends it back as its own claim.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await lookupInvite(token);

  if (!result.ok) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }
  return NextResponse.json({ valid: true, email: result.invite.email });
}

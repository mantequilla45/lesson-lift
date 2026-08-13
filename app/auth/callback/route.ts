import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";

// OAuth (Google) and email-link callbacks land here. Supabase returns a `code`
// in the query string; we exchange it for a session, then send the user on.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // A suspended account fails the exchange with user_banned. Distinguish it,
    // or a banned teacher signing in with Google lands back on the login form
    // with a generic "could not sign you in" and no idea their account was
    // suspended — the password path tells them, so this one has to as well.
    if (error?.code === "user_banned") {
      return NextResponse.redirect(`${origin}/login?error=suspended`);
    }
    if (!error) {
      // A first-time Google user has no profile row yet. Route them through
      // the same onboarding as email sign-ups: set a password (so they can
      // also log in with email later), then complete their profile. Returning
      // users already have a profile, so send them straight on.
      //
      // Resolve the user id robustly: depending on the SDK/flow the freshly
      // exchanged user can sit on `data.user` OR `data.session.user`. Fall back
      // to getUser() so we never skip onboarding just because `data.user` was
      // null — that bug sent brand-new Google users straight to the home page.
      let userId: string | undefined = data.user?.id ?? data.session?.user?.id;
      if (!userId) {
        const { data: u } = await supabase.auth.getUser();
        userId = u.user?.id;
      }
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, suspended_at")
          .eq("id", userId)
          .maybeSingle();
        if (!profile) {
          return NextResponse.redirect(`${origin}/create-password`);
        }
        // Belt and braces alongside the user_banned check above: if a session
        // was somehow issued to a suspended account (a ban applied mid-flow, or
        // a token minted just before it), don't let them through. Costs nothing
        // — this row was already being fetched.
        if (profile.suspended_at) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=suspended`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { MdLock } from "react-icons/md";
import { Mail } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import { usePublicSettings } from "@/app/lib/usePublicSettings";

export default function SignupPage() {
  const router = useRouter();
  const settings = usePublicSettings();
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<
    { state: "none" } | { state: "loading" } | { state: "valid"; email: string } | { state: "invalid"; message: string }
  >({ state: "none" });

  // An admin-sent invite arrives as /signup?invite=<token>. It's stashed in
  // sessionStorage rather than held in state because the page that needs it is
  // /complete-profile, two navigations later — it hands the token to
  // /api/invites/accept, which is the only place it's actually verified.
  // Nothing here grants anything.
  //
  // Read from window rather than useSearchParams(): that hook forces a
  // client-side bailout needing a Suspense boundary around the whole form, for
  // a value this page only needs after mount. Same reasoning as the fragment
  // read in app/login/page.tsx.
  //
  // An invited teacher must end up on the invited address — that's what
  // /api/invites/accept matches on — so the field is prefilled and locked
  // rather than left open for them to mistype a different one.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;

    let cancelled = false;

    (async () => {
      sessionStorage.setItem("jooma:invite-token", token);
      setInvite({ state: "loading" });
      const res = await fetch(`/api/invites/check?token=${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;

      if (json?.valid) {
        setInvite({ state: "valid", email: json.email });
        setEmail(json.email);
        return;
      }
      sessionStorage.removeItem("jooma:invite-token");
      setInvite({
        state: "invalid",
        message:
          json?.reason === "expired"
            ? "That invitation has expired. Ask your administrator to send a new one."
            : json?.reason === "accepted"
            ? "That invitation has already been used. Try signing in instead."
            : "That invitation link isn't valid. You can still sign up below.",
      });
    })();

    return () => {
      cancelled = true;
    };
    // Mount only: the invite token comes from the URL, which can't change
    // under this page.
  }, []);

  const emailLocked = invite.state === "valid";

  // Closed signups don't apply to someone holding a valid invite — the profiles
  // INSERT policy makes the same exception, so blocking them here would refuse
  // a signup the database would have allowed.
  const signupsClosed =
    settings.loaded && !settings.signupsOpen && invite.state !== "valid";

  const canSubmit =
    email.trim().length > 0 && agreed && invite.state !== "loading" && !signupsClosed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    sessionStorage.setItem("jooma:auth-email", email.trim());
    router.push("/create-password");
  };

  const handleGoogle = async () => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError("Could not start Google sign-in.");
  };

  return (
    <div className="min-h-screen p-6 flex" style={{ backgroundColor: "#F1EFE3" }}>
      <div className="w-full max-w-9xl mx-auto grid gap-6 lg:grid-cols-2">
        {/* Illustration panel */}
        <div
          className="rounded-3xl p-10 flex items-center justify-center"
          style={{ backgroundColor: "#E8E6D9" }}
        >
          <Image
            src="/svgs/teacher.svg"
            alt=""
            width={467}
            height={662}
            priority
            className="w-auto h-full max-h-full object-contain"
          />
        </div>

        {/* Form panel */}
        <div
          className="rounded-3xl px-10 py-12 flex flex-col"
          style={{ backgroundColor: "#FAF9F5" }}
        >
          <div className="mx-auto w-full max-w-100 flex-1 flex flex-col justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo.svg" alt="Jooma" className="mx-auto mb-6" style={{ height: 34, width: "auto" }} />

            <div className="text-center mb-8">
              <h2 className="text-4xl font-medium leading-tight tracking-tight">
                {invite.state === "valid" ? (
                  <>
                    You&rsquo;ve been
                    <br />
                    invited to Jooma
                  </>
                ) : (
                  <>
                    Save hours
                    <br />
                    of planning time
                  </>
                )}
              </h2>
              <p className="mt-3 text-sm text-muted font-light">
                Create differentiated lessons instantly with AI.
              </p>
            </div>

            {invite.state === "valid" && (
              <div
                className="mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3"
                style={{ backgroundColor: "#EEF4EC", borderColor: "#CFE0CA" }}
              >
                <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#3F6B37" }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: "#2F5228" }}>
                    Invitation for {invite.email}
                  </p>
                  <p className="mt-0.5 text-sm font-light" style={{ color: "#4A6B44" }}>
                    Choose how you&rsquo;d like to sign in — continue with Google, or set a
                    password below. Either way, use this address so we can match your
                    invitation.
                  </p>
                </div>
              </div>
            )}

            {invite.state === "invalid" && (
              <div
                className="mb-6 rounded-2xl border px-4 py-3"
                style={{ backgroundColor: "#FBECEB", borderColor: "#EDD3D1" }}
              >
                <p className="text-sm font-semibold" style={{ color: "#B3261E" }}>
                  Invitation problem
                </p>
                <p className="mt-0.5 text-sm font-light" style={{ color: "#8A3B34" }}>
                  {invite.message}
                </p>
              </div>
            )}

            {signupsClosed && (
              <div
                className="mb-6 rounded-2xl border px-4 py-3"
                style={{ backgroundColor: "#FBF3E6", borderColor: "#E8D9BC" }}
              >
                <p className="text-sm font-semibold" style={{ color: "#7A5A1E" }}>
                  Signups are closed right now
                </p>
                <p className="mt-0.5 text-sm font-light" style={{ color: "#8A6E36" }}>
                  Jooma isn&rsquo;t open to new accounts at the moment. If you were sent an
                  invitation, open the link in that email instead — it will still work.
                </p>
              </div>
            )}

            {settings.googleSignin && !signupsClosed && (
              <>
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-line text-sm font-medium hover:border-dark transition-colors mb-6"
                >
                  <FcGoogle className="w-5 h-5" />
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px bg-line flex-1" />
                  <span className="text-xs text-muted">or</span>
                  <div className="h-px bg-line flex-1" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm mb-2 leading-tight tracking-tight font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  // An invite is matched on the address it was sent to, so a
                  // teacher who edits this here would only fail later, at
                  // acceptance, with nothing to show for it.
                  readOnly={emailLocked}
                  aria-readonly={emailLocked}
                  className={`w-full px-4 py-3 border border-line rounded-xl text-sm leading-tight tracking-tight font-medium placeholder-[#A5A5A5] focus:outline-none focus:border-dark transition-colors ${
                    emailLocked ? "bg-[#F1EFE3] text-muted cursor-not-allowed" : "bg-white"
                  }`}
                />
              </div>

              <label className="mt-4 flex items-start gap-2 text-sm text-muted font-light">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-line accent-dark"
                />
                <span>
                  By signing up, you agree to our{" "}
                  <Link href="/terms" className="text-dark hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-dark hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              {error && (
                <p className="mt-3 text-sm text-red-600 font-light">{error}</p>
              )}

              <div className="mt-8 flex justify-center">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="px-10 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:bg-[#F1EFE3] disabled:text-[#A5A5A5] disabled:cursor-default bg-[#030303] hover:bg-black"
                >
                  Sign up with Email
                </button>
              </div>
            </form>

            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-line p-4">
              <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <MdLock className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Secure & GDPR compliant</p>
                <p className="text-xs text-muted font-light">
                  Your privacy matters — we protect your data
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-dark hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

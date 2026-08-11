"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { MdLock } from "react-icons/md";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";

const SUSPENDED_MESSAGE =
  "This account has been suspended. If you think that's a mistake, contact support and we'll take another look.";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  // Google sign-in leaves the page entirely, so a suspended account can only be
  // reported by whatever lands back here.
  //
  // Supabase rejects a banned user in the URL FRAGMENT, not the query string:
  //
  //   /login?error=auth#error=access_denied&error_code=user_banned&...
  //
  // A fragment is never sent to the server, so /auth/callback cannot see it and
  // falls through to its generic ?error=auth — which is why a banned Google user
  // used to get "Could not sign you in" with no explanation. The fragment is
  // readable only here, on the client, so this is the only place the real reason
  // can be recovered. Check it FIRST and let it win over the query string.
  //
  // Read from window rather than useSearchParams(): that hook sees only the
  // query string anyway, and forces a client-side bailout needing a Suspense
  // boundary around the whole form.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const reason = hash.get("error_code") ?? query.get("error");

    if (reason === "user_banned" || reason === "suspended") {
      setError(SUSPENDED_MESSAGE);
    } else if (reason) {
      setError("Could not sign you in. Please try again.");
    }

    // Strip the error off the URL once it's been shown. Otherwise a refresh —
    // or a successful sign-in that re-renders this page — keeps re-displaying a
    // stale failure, and the fragment lingers in the address bar.
    if (hash.has("error_code") || query.has("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      // A suspended account has to say so. Reporting "incorrect email or
      // password" — which is what every failure used to say — sends someone
      // whose credentials are perfectly correct into retrying them forever,
      // and then to support to ask why their password stopped working.
      setError(error.code === "user_banned" ? SUSPENDED_MESSAGE : "Incorrect email or password.");
      setLoading(false);
      return;
    }
    router.push("/tools");
    router.refresh();
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
                Save hours
                <br />
                of planning time
              </h2>
              <p className="mt-3 text-sm text-muted font-light">
                Create differentiated lessons instantly with AI.
              </p>
            </div>

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
                  className="w-full px-4 py-3 border border-line rounded-xl bg-white text-sm font-light placeholder-[#A5A5A5] focus:outline-none focus:border-dark transition-colors"
                />
              </div>

              <div className="mt-4">
                <label htmlFor="password" className="block text-sm mb-2 leading-tight tracking-tight font-medium">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full pl-4 pr-12 py-3 border border-line rounded-xl bg-white text-sm font-light placeholder-[#A5A5A5] focus:outline-none focus:border-dark transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-dark"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error &&
                (error === SUSPENDED_MESSAGE ? (
                  // A suspension is not a typo — it's an account state the
                  // teacher can do nothing about by retrying, so it gets a
                  // banner rather than the same one-line hint as a wrong
                  // password.
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border px-4 py-3"
                    style={{ backgroundColor: "#FBECEB", borderColor: "#EDD3D1" }}
                  >
                    <p className="text-sm font-semibold" style={{ color: "#B3261E" }}>
                      Account suspended
                    </p>
                    <p className="mt-0.5 text-sm font-light" style={{ color: "#8A3B34" }}>
                      {error}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-red-600 font-light" role="alert">
                    {error}
                  </p>
                ))}

              <div className="mt-8 flex justify-center">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="px-10 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:bg-[#F1EFE3] disabled:text-[#A5A5A5] disabled:cursor-default bg-[#030303] hover:bg-black"
                >
                  {loading ? "Signing in…" : "Sign in with Email"}
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
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-dark hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

// Change password.
//
// The only self-serve password change in the app. /create-password is the
// adjacent flow but a different one: it lands from an admin-issued recovery link
// (or a fresh sign-up) and sets a password with no current one to check.

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import { checkPassword } from "@/app/lib/password";
import { ChangePasswordSkeleton } from "./Skeletons";

export default function ChangePasswordSection() {
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  // An account created through Google has no password to change. Rather than
  // let the re-auth below fail with something cryptic, the form is replaced with
  // an explanation.
  const [hasPassword, setHasPassword] = useState(true);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nextTouched, setNextTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(user?.email ?? null);
      // `providers` lists every identity linked to the account. "email" is
      // present exactly when there is a password to verify.
      const providers = (user?.app_metadata?.providers ?? []) as string[];
      setHasPassword(providers.includes("email"));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rules = checkPassword(next);
  const meetsRules = rules.every((r) => r.met);
  const matches = next !== "" && next === confirm;
  const canSubmit =
    current !== "" && meetsRules && matches && !busy && email !== null;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 5000);
    return () => clearTimeout(t);
  }, [done]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Someone who hits submit without leaving a field has touched nothing, so
    // the reasons it is disabled would stay hidden.
    setNextTouched(true);
    setConfirmTouched(true);
    if (!canSubmit || !email) return;

    setBusy(true);
    setError(null);
    setDone(false);
    const supabase = createClient();

    // Verify the CURRENT password before changing it.
    //
    // Nothing else in the app does this — /create-password calls updateUser on
    // an already-authenticated session with no re-check, which is right for a
    // recovery link but wrong for a form that asks for the current password and
    // would otherwise ignore what was typed. Signing in as the account that is
    // already signed in refreshes the same session rather than opening a second
    // one, so this costs a round trip and nothing else.
    const { error: reauth } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauth) {
      setError("That current password isn't right.");
      setBusy(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updateErr) {
      setError("Could not change your password. Please try again.");
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setNextTouched(false);
    setConfirmTouched(false);
    setDone(true);
  };

  if (!loaded) return <ChangePasswordSkeleton />;

  return (
    <div
      className="rounded-3xl p-6 sm:p-8 border"
      style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
    >
      <h2 className="text-lg font-bold mb-6" style={{ color: "#1a1a1a" }}>
        Change password
      </h2>

      {!hasPassword ? (
        <div className="max-w-lg">
          <p className="text-sm" style={{ color: "#1a1a1a" }}>
            You sign in with Google, so there&apos;s no password on this account
            to change.
          </p>
          <p className="text-sm mt-2" style={{ color: "#8a8078" }}>
            Your Google account controls how you sign in. To add a password
            instead, get in touch through Submit ticket.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-lg">
          <PasswordField
            id="current-password"
            label="Current password"
            placeholder="Enter current password"
            value={current}
            onChange={setCurrent}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />

          <div className="mt-4">
            <PasswordField
              id="new-password"
              label="New password"
              placeholder="Enter new password"
              value={next}
              onChange={setNext}
              visible={showNext}
              onToggleVisible={() => setShowNext((v) => !v)}
              onBlur={() => setNextTouched(true)}
              invalid={nextTouched && !meetsRules}
              autoComplete="new-password"
            />
            <ul className="mt-2 space-y-1" aria-live="polite">
              {rules.map((rule) => {
                const failing = nextTouched && !rule.met;
                return (
                  <li
                    key={rule.key}
                    className={`flex items-center gap-1.5 text-xs font-light ${
                      rule.met
                        ? "text-emerald-600"
                        : failing
                        ? "text-red-500"
                        : "text-muted"
                    }`}
                  >
                    {rule.met ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : failing ? (
                      <X className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      // Keeps the rows from shifting sideways as icons swap in.
                      <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        <span className="w-1 h-1 rounded-full bg-current" />
                      </span>
                    )}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4">
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              visible={showConfirm}
              onToggleVisible={() => setShowConfirm((v) => !v)}
              onBlur={() => setConfirmTouched(true)}
              invalid={confirmTouched && confirm !== "" && !matches}
              autoComplete="new-password"
            />
            {confirmTouched && confirm !== "" && !matches && (
              <p className="mt-2 text-xs text-red-500 font-light">
                Both passwords must match.
              </p>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-red-600 font-light">{error}</p>}

          <div className="mt-7 flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-8 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:bg-[#F1EFE3] disabled:text-[#A5A5A5] disabled:cursor-default bg-[#030303] hover:bg-black cursor-pointer"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {done && (
              <span
                className="text-sm font-medium"
                role="status"
                style={{ color: "#1f6b3b" }}
              >
                Password changed
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/** A labelled password input with a show/hide toggle. Mirrors the field in
 *  app/create-password/page.tsx — same classes, same eye button — so the two
 *  password forms look like one feature. */
function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  visible,
  onToggleVisible,
  onBlur,
  invalid,
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  onBlur?: () => void;
  invalid?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm mb-2 leading-tight tracking-tight font-medium"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          className={`w-full pl-4 pr-12 py-3 border rounded-xl bg-white text-sm leading-tight tracking-tight font-medium placeholder-[#A5A5A5] placeholder:font-light focus:outline-none transition-colors ${
            invalid ? "border-red-400 focus:border-red-400" : "border-line focus:border-dark"
          }`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-dark cursor-pointer"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

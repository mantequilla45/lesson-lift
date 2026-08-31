"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LockKey } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/app/lib/auth/client";
import AuthLayout from "@/app/components/v2/AuthLayout";
import auth from "@/app/components/v2/auth.module.css";
import styles from "./verify.module.css";

const CODE_LENGTH = 6;
const FALLBACK_EMAIL = "your email";

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState(FALLBACK_EMAIL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("jooma:auth-email");
    if (stored) setEmail(stored);
  }, []);

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");
  const canSubmit =
    code.length === CODE_LENGTH && digits.every((d) => d !== "") && !loading;

  const handleVerify = async () => {
    if (!canSubmit) return;
    const storedEmail = sessionStorage.getItem("jooma:auth-email");
    if (!storedEmail) {
      setError("Your session expired. Please sign up again.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: storedEmail,
      token: code,
      type: "email",
    });
    if (error) {
      setError("That code is incorrect or has expired.");
      setLoading(false);
      return;
    }
    router.push("/create-password");
  };

  const handleResend = async () => {
    const storedEmail = sessionStorage.getItem("jooma:auth-email");
    if (!storedEmail) return;
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: storedEmail,
      options: { shouldCreateUser: true },
    });
    if (error) setError("Could not resend the code. Please try again.");
  };

  const focusInput = (index: number) => {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  };

  const handleChange = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < CODE_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      focusInput(index - 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH - index);
    if (!pasted) return;
    e.preventDefault();
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < pasted.length; i++) {
        next[index + i] = pasted[i]!;
      }
      return next;
    });
    const nextFocus = Math.min(index + pasted.length, CODE_LENGTH - 1);
    setTimeout(() => focusInput(nextFocus), 0);
  };

  return (
    <AuthLayout
      title="Check your email"
      lede={
        <>
          We have sent a six digit code to{" "}
          <strong className={styles.email}>{email}</strong>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
      >
        <div className={styles.code}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => e.target.select()}
              aria-label={`Digit ${i + 1}`}
              className={styles.digit}
            />
          ))}
        </div>

        {error && (
          <p className={`${auth.error} ${styles.centre}`} role="alert">
            {error}
          </p>
        )}

        <p className={styles.resend}>
          Nothing arrived?{" "}
          <button type="button" onClick={handleResend} className={styles.resendBtn}>
            Send it again
          </button>
        </p>

        <button type="submit" disabled={!canSubmit} className={auth.submit}>
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      <div className={auth.trust}>
        <span className={auth.trustIcon}>
          <LockKey weight="fill" />
        </span>
        <div>
          <p className={auth.trustTitle}>Secure and GDPR compliant</p>
          <p className={auth.trustBody}>Your data stays yours, and your pupils&apos; stays theirs.</p>
        </div>
      </div>
    </AuthLayout>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Info, Loader2, UserPlus, X } from "lucide-react";
import DialCodeSelect, { DEFAULT_DIAL_CODE } from "@/app/components/DialCodeSelect";
import { checkPassword } from "@/app/lib/password";

// Mirrors the real 3-step signup journey (signup -> create-password ->
// complete-profile) collapsed into one modal, same fields in the same order.
//
// The real signup flow creates the account via supabase.auth.signUp(), which
// signs the CURRENT browser session in as the new user — calling that from
// here would log the admin out and into the teacher's account. Instead this
// posts to /api/admin/create-teacher, which uses the Supabase service role
// (auth.admin.createUser) server-side so the admin's own session is
// untouched. The teacher's email is pre-confirmed since the admin is setting
// their password directly rather than sending an invite link.

const fieldClass =
  "w-full px-3.5 py-2.5 border rounded-xl bg-white text-sm font-medium placeholder-[#9A93AD] focus:outline-none focus:border-[#1D1730] transition-colors";
const fieldStyle = { borderColor: "#EAE6F5" };

function PasswordInput({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className={`${fieldClass} pr-10`}
        style={fieldStyle}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#6D6683] hover:text-[#1D1730]"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AddTeacherModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [dialCountry, setDialCountry] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rules = checkPassword(password);
  const meetsRules = rules.every((r) => r.met);
  const matches = password.length > 0 && password === confirm;
  const showMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    email.trim() !== "" && meetsRules && matches && firstName.trim() !== "" && surname.trim() !== "" && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/create-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          surname: surname.trim(),
          dialCode: dialCountry,
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data?.error ?? "Could not create the account. Please try again.");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setNotice("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]"
        style={{ borderColor: "#EAE6F5", backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-start gap-3 p-6 pb-4 border-b shrink-0" style={{ borderColor: "#EAE6F5" }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#F1ECFC" }}
          >
            <UserPlus className="w-5 h-5" style={{ color: "#1D1730" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold" style={{ color: "#1D1730" }}>
              Add teacher
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "#6D6683" }}>
              Same details a teacher fills in when they sign up themselves.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5"
            style={{ color: "#6D6683" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3C3552" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.sch.uk"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3C3552" }}>
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3C3552" }}>
                  Surname
                </label>
                <input
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Surname"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3C3552" }}>
                Phone number
              </label>
              <div className="flex gap-2">
                <DialCodeSelect value={dialCountry} onChange={setDialCountry} />
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className={`flex-1 min-w-0 ${fieldClass}`}
                  style={fieldStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3C3552" }}>
                Password
              </label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Enter a password"
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
              <ul className="mt-1.5 space-y-1" aria-live="polite">
                {rules.map((rule) => (
                  <li
                    key={rule.key}
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: rule.met ? "#0F6E56" : "#6D6683" }}
                  >
                    {rule.met ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Info className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3C3552" }}>
                Confirm password
              </label>
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                placeholder="Re-enter the password"
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
              />
              {showMismatch && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500" role="alert">
                  <X className="w-3.5 h-3.5 shrink-0" />
                  Passwords don&rsquo;t match
                </p>
              )}
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-2 p-6 pt-4 border-t shrink-0"
            style={{ borderColor: "#EAE6F5" }}
          >
            <p className="text-xs" style={{ color: notice ? "#8A3C12" : "#6D6683" }}>
              {notice ?? " "}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold rounded-xl border px-4 py-2 transition-colors hover:bg-black/5"
                style={{ borderColor: "#EAE6F5", color: "#1D1730" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "#5B2ED6" }}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? "Creating…" : "Create account"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

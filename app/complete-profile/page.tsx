"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import DialCodeSelect, {
  DEFAULT_DIAL_CODE as DEFAULT_CODE,
} from "@/app/components/DialCodeSelect";
// Field/TextInput/CountrySelect used to live at the bottom of this file. They
// moved to a shared module when /profile needed the same three — see the header
// comment there.
import { Field, TextInput, CountrySelect } from "@/app/components/ui/FormFields";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [dialCountry, setDialCountry] = useState(DEFAULT_CODE);
  const [phone, setPhone] = useState("");
  // Seeded from the dial code so the user doesn't have to pick twice.
  const [country, setCountry] = useState<string | null>(DEFAULT_CODE);

  // Keep country in sync when the dial code changes (user can still override).
  useEffect(() => { setCountry(dialCountry); }, [dialCountry]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    firstName.trim() !== "" &&
    surname.trim() !== "" &&
    phone.trim() !== "" &&
    country !== null &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    let { data: { user } } = await supabase.auth.getUser();

    // If the cookie race-condition means no session yet, try restoring from
    // the token stashed by create-password right after signUp.
    if (!user) {
      const accessToken  = sessionStorage.getItem("jooma:auth-token");
      const refreshToken = sessionStorage.getItem("jooma:auth-refresh");
      if (accessToken) {
        const { data: restored } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        });
        user = restored.user ?? null;
      }
    }

    if (!user) {
      setError("Your session expired. Please sign in again.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: firstName.trim(),
      surname: surname.trim(),
      dial_code: dialCountry,
      phone: phone.trim(),
      country,
    });
    if (error) {
      setError("Could not save your profile. Please try again.");
      setLoading(false);
      return;
    }

    // An admin-invited teacher had their plan chosen before this row existed.
    // Applying it is the server's job: /api/invites/accept re-verifies the
    // token and checks it was issued to THIS address before touching `plan`,
    // which teachers can't self-update anyway (see
    // 20260811000400_lock_down_profile_self_update.sql). Sending the plan from
    // here instead would let anyone hand themselves Pro.
    //
    // Runs after the upsert because the invite grants a plan to a profile that
    // has to already exist. A self-signup has no token and skips it.
    const inviteToken = sessionStorage.getItem("jooma:invite-token");
    if (inviteToken) {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
      if (!res.ok) {
        // The profile is saved either way — this only decides the plan — so
        // report it and let them continue on Free rather than stranding them
        // on a form they can't get past. The admin can re-invite.
        const json = await res.json().catch(() => ({}));
        setError(
          `${json.error ?? "Your invitation couldn't be applied."} Your account is set up — continuing on the Free plan.`,
        );
        sessionStorage.removeItem("jooma:invite-token");
        setLoading(false);
        return;
      }
      sessionStorage.removeItem("jooma:invite-token");
    }

    sessionStorage.removeItem("jooma:auth-email");
    sessionStorage.removeItem("jooma:auth-token");
    sessionStorage.removeItem("jooma:auth-refresh");
    router.push("/tools");
    router.refresh();
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
          <div className="mx-auto w-full max-w-110 flex-1 flex flex-col justify-center">
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

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First name" htmlFor="firstName">
                  <TextInput
                    id="firstName"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="First name"
                  />
                </Field>
                <Field label="Surname" htmlFor="surname">
                  <TextInput
                    id="surname"
                    value={surname}
                    onChange={setSurname}
                    placeholder="Surname"
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Phone number" htmlFor="phone">
                  <div className="flex gap-2">
                    <DialCodeSelect value={dialCountry} onChange={setDialCountry} />
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      className="flex-1 min-w-0 px-4 py-3 border border-line rounded-xl bg-white text-sm leading-tight tracking-tight font-medium placeholder-[#A5A5A5] placeholder:font-light focus:outline-none focus:border-dark transition-colors"
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Country" htmlFor="country">
                  <CountrySelect value={country} onChange={setCountry} />
                </Field>
              </div>

              {error && (
                <p className="mt-6 text-center text-sm text-red-600 font-light">{error}</p>
              )}

              <div className="mt-8 flex justify-center">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="px-10 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:bg-[#F1EFE3] disabled:text-[#A5A5A5] disabled:cursor-default bg-[#030303] hover:bg-black"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

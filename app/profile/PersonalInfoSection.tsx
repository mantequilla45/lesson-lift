"use client";

// Personal info — name, photo, email, phone, country.
//
// Everything here writes to columns that already existed and that
// profiles_guard_privileged_columns_trg permits a teacher to edit. The guard is
// a deny-list (is_admin, plan, subscription_status, stripe_*, school_id,
// suspended_*), so this form is safe by construction: none of those fields are
// on it, and adding one would be rejected by the database rather than silently
// applied.

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import DialCodeSelect, { DEFAULT_DIAL_CODE } from "@/app/components/DialCodeSelect";
import { Field, TextInput, CountrySelect, INPUT_CLASS } from "@/app/components/ui/FormFields";
import Avatar from "@/app/components/ui/Avatar";
// The chrome renders the same name and photo. Publishing to this store is what
// updates the navbar without a reload — TopBar is a sibling, so it cannot be
// passed a prop, and router.refresh() does not reach a client component's state.
import { setProfileIdentity } from "@/app/lib/useProfileIdentity";
import { PersonalInfoSkeleton } from "./Skeletons";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;

/** Extension for the stored object. The bucket is public and served by
 *  content-type, so this is for legibility in the Storage browser more than
 *  anything — but a path with no extension is a nuisance to debug. */
function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Turns a public Storage URL back into the object path inside the bucket, so
 *  a replaced photo can be deleted. Returns null for anything that isn't one of
 *  ours — a future OAuth avatar hosted elsewhere must not be "cleaned up". */
function objectPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split("?")[0];
}

export default function PersonalInfoSection() {
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [dialCountry, setDialCountry] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("first_name, surname, dial_code, phone, country, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      setUserId(user.id);
      // Email is not a column on profiles — it lives on auth.users, and this
      // form shows it read-only. Changing it needs a confirmation round trip
      // that nothing in the app does yet.
      setEmail(user.email ?? "");
      setFirstName(data?.first_name ?? "");
      setSurname(data?.surname ?? "");
      setDialCountry(data?.dial_code ?? DEFAULT_DIAL_CODE);
      setPhone(data?.phone ?? "");
      setCountry(data?.country ?? null);
      setAvatarUrl(data?.avatar_url ?? null);
      setLoaded(true);

      // Seed the shared store from the same read, so a direct visit to /profile
      // doesn't leave the navbar waiting on its own round trip. setProfileIdentity
      // no-ops when the values match, so this costs nothing when TopBar got
      // there first.
      setProfileIdentity({
        name: [data?.first_name, data?.surname].filter(Boolean).join(" "),
        avatarUrl: data?.avatar_url ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullName = [firstName, surname].filter(Boolean).join(" ");

  // ── Photo ────────────────────────────────────────────────────────────────
  //
  // Uploads go straight from the browser to Storage. The bucket policy is the
  // authorization — writes require `authenticated` and an object path inside a
  // folder named after the caller's uid — so an API route in front of this
  // would add a hop without adding a check.

  const handlePhoto = async (file: File) => {
    if (!userId) return;
    setPhotoError(null);

    if (!ACCEPTED.includes(file.type as (typeof ACCEPTED)[number])) {
      setPhotoError("Choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setPhotoError("That image is over 2 MB. Choose a smaller one.");
      return;
    }

    setPhotoBusy(true);
    const supabase = createClient();
    const previous = objectPathFromUrl(avatarUrl);
    const path = `${userId}/${Date.now()}.${extensionFor(file.type)}`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) {
      setPhotoError("Could not upload that photo. Please try again.");
      setPhotoBusy(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    const { error: rowErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);
    if (rowErr) {
      setPhotoError("Photo uploaded but not saved. Please try again.");
      setPhotoBusy(false);
      return;
    }

    setAvatarUrl(publicUrl);
    setPhotoBusy(false);
    // Updates the navbar immediately.
    setProfileIdentity({ name: fullName, avatarUrl: publicUrl });

    // Best-effort tidy-up of the photo this one replaced. A failure here leaves
    // an orphan in the bucket, which is not worth failing a successful save
    // over — so it is deliberately unawaited and unchecked.
    if (previous && previous !== path) {
      void supabase.storage.from(AVATAR_BUCKET).remove([previous]);
    }
  };

  const removePhoto = async () => {
    if (!userId || !avatarUrl) return;
    setPhotoBusy(true);
    setPhotoError(null);
    const supabase = createClient();
    const path = objectPathFromUrl(avatarUrl);

    const { error: rowErr } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    if (rowErr) {
      setPhotoError("Could not remove that photo. Please try again.");
      setPhotoBusy(false);
      return;
    }

    setAvatarUrl(null);
    setPhotoBusy(false);
    setProfileIdentity({ name: fullName, avatarUrl: null });
    if (path) void supabase.storage.from(AVATAR_BUCKET).remove([path]);
  };

  // ── Details ──────────────────────────────────────────────────────────────

  const canSave =
    loaded &&
    userId !== null &&
    firstName.trim() !== "" &&
    surname.trim() !== "" &&
    !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !userId) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();
    // update, not upsert: the row exists by the time anyone can reach this page
    // (/complete-profile creates it), and profiles_guard_insert_trg has opinions
    // about inserts that this form has no reason to test.
    const { error: e2 } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        surname: surname.trim(),
        dial_code: dialCountry,
        phone: phone.trim(),
        country,
      })
      .eq("id", userId);

    setSaving(false);
    if (e2) {
      setError("Could not save your details. Please try again.");
      return;
    }
    setSaved(true);
    // The name feeds the initials placeholder and the account menu, so the
    // navbar has to hear about a rename too — not just a new photo. Built from
    // the submitted values rather than `fullName`, which is derived from state
    // that has not re-rendered yet at this point.
    setProfileIdentity({
      name: [firstName.trim(), surname.trim()].filter(Boolean).join(" "),
      avatarUrl,
    });
  };

  // Clear the confirmation after a beat, so it reads as a response to the click
  // rather than a permanent label on the button.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  if (!loaded) return <PersonalInfoSkeleton />;

  return (
    <div
      className="rounded-3xl p-6 sm:p-8 border"
      style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
    >
      <h2 className="text-lg font-bold mb-6" style={{ color: "#1a1a1a" }}>
        Personal info
      </h2>

      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 mb-8">
        <Avatar url={avatarUrl} name={fullName} size={96} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Opened by the button below via .click(). `hidden` matches every
                other file input in the app — the assistant composer, the
                editor, the invite modal. */}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset first, so re-picking the same file fires change again.
                e.target.value = "";
                if (file) void handlePhoto(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white transition-colors hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
            >
              {photoBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => void removePhoto()}
                disabled={photoBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ color: "#8a8078" }}
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: "#8a8078" }}>
            PNG, JPG or WebP, up to 2 MB.
          </p>
          {photoError && (
            <p className="text-xs mt-1.5" style={{ color: "#B3261E" }}>
              {photoError}
            </p>
          )}
        </div>
      </div>

      {/* ── Details ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name" htmlFor="firstName">
            <TextInput
              id="firstName"
              value={firstName}
              onChange={setFirstName}
              placeholder="First name"
              autoComplete="given-name"
            />
          </Field>
          <Field label="Surname" htmlFor="surname">
            <TextInput
              id="surname"
              value={surname}
              onChange={setSurname}
              placeholder="Surname"
              autoComplete="family-name"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              aria-describedby="email-note"
              className={`${INPUT_CLASS} bg-[#F1EFE3] text-[#8a8078] cursor-not-allowed`}
            />
            <p id="email-note" className="text-xs mt-1.5" style={{ color: "#8a8078" }}>
              Contact support if you need to change this.
            </p>
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
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className={`flex-1 min-w-0 ${INPUT_CLASS}`}
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
          <p className="mt-4 text-sm text-red-600 font-light">{error}</p>
        )}

        <div className="mt-7 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSave}
            className="px-8 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:bg-[#F1EFE3] disabled:text-[#A5A5A5] disabled:cursor-default bg-[#030303] hover:bg-black cursor-pointer"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span className="text-sm font-medium" role="status" style={{ color: "#1f6b3b" }}>
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

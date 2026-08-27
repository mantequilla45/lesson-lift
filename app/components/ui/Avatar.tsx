"use client";

// The teacher's profile photo, wherever it appears: the TopBar button, the
// account dropdown, the landing nav, and the personal-info form.
//
// A plain <img>, not next/image: next/image would need every Storage hostname
// in next.config remotePatterns, and an avatar is already a small file served
// from a CDN-backed public bucket.
//
// The raw public URL is used AS-IS. It deliberately does NOT go through
// toThumbnailUrl: that rewrites a Storage URL to /render/image/, which is
// Supabase's image-transformation add-on, and this project does not have it
// enabled — the endpoint answers 403 FeatureNotEnabled. Routing avatars through
// it made every upload appear to fail: the file uploaded fine, the <img> got a
// 403, and onError below quietly swapped in the placeholder.
//
// If transformations are ever enabled on the project, reinstating the resize
// here is a one-line change worth making — an avatar shown at 36px does not
// need the full upload. Until then the 2 MB cap in PersonalInfoSection is what
// keeps these small.

import { useState } from "react";
import { UserCircle } from "lucide-react";

/** Up to two letters from a name. "Emily Carter" → "EC", "Emily" → "E".
 *  Exported because the admin console renders initials from a single display
 *  string and can reuse the rule without importing the component. */
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Avatar({
  url,
  name,
  size = 36,
  className = "",
}: {
  url?: string | null;
  /** Used for the initials placeholder and the alt text. Empty is fine — the
   *  placeholder falls back to a glyph. */
  name?: string | null;
  size?: number;
  className?: string;
}) {
  // A photo that 404s (the object was deleted, or the row points somewhere
  // stale) must not leave a broken-image icon in the navbar. This records the
  // url that failed, and the placeholder stands in for it.
  //
  // Storing the failed URL rather than a boolean is what resets it when the
  // source changes: a plain flag would need an effect to clear, and a single
  // failure would otherwise poison every subsequent photo. This is React's
  // "adjust state during render" pattern, without the extra render pass.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const initials = initialsFor(name ?? "");
  const src = url && url !== failedUrl ? url : undefined;

  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={name ? `${name}'s profile photo` : "Profile photo"}
        width={size}
        height={size}
        onError={() => setFailedUrl(url ?? null)}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Placeholder. Initials when we know the name, the lucide glyph when we don't
  // — which is the case on first paint, before the profile row has loaded, and
  // for an account that never completed one.
  return (
    <span
      aria-hidden={!name}
      role={name ? "img" : undefined}
      aria-label={name ? `${name}'s profile photo` : undefined}
      className={`rounded-full shrink-0 flex items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#E8E6D9",
        color: "#6b6055",
        // Scales with the circle so one component serves both the 36px navbar
        // and the 96px form without a size lookup table.
        fontSize: Math.round(size * 0.4),
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {initials || <UserCircle style={{ width: size * 0.62, height: size * 0.62 }} />}
    </span>
  );
}

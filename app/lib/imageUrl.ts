// Pure URL string transforms for Supabase Storage images.
//
// Split out of imageStorage.ts so client components can import it. That module
// creates a Supabase client at module scope; importing it from the browser to
// reach one string function would pull @supabase/supabase-js and a second
// GoTrue instance into the bundle for nothing. MiniSlide.tsx is the client
// component that does exactly this — it still reaches toThumbnailUrl through
// imageStorage, and should be pointed here.
//
// No "use client" and no imports — safe from either side.
//
// !! IMAGE TRANSFORMATION IS NOT ENABLED ON THIS SUPABASE PROJECT.
// The /render/image/ endpoint this function rewrites to answers
//   403 {"error":"FeatureNotEnabled","message":"feature not enabled for this tenant"}
// for every object, in every bucket. Verified against both `images` and
// `avatars` with real uploaded files.
//
// So any <img> pointed at a transformed URL fails to load. Avatar used to do
// this and it made avatar uploads look broken: the file uploaded fine, the
// image 403'd, and the onError fallback quietly showed the initials placeholder
// — indistinguishable from "nothing happened". Avatar now uses the raw public
// URL. MiniSlide's thumbnails still call this and are presumably failing the
// same way; that predates the profile work and is untouched here.
//
// Before using this anywhere new, either enable transformations on the project
// or don't.

/** Rewrites a Supabase Storage public URL to its image-transformation
 *  endpoint at a smaller width, so thumbnails don't pull the full-size source.
 *  Non-Supabase URLs and data URLs pass through unchanged. Width is rounded to
 *  the next 100 to maximise CDN cache hits.
 *
 *  Only `width` is specified — the CDN preserves the source's aspect ratio
 *  automatically. Specifying `resize=cover` without `height` produced a
 *  visibly stretched image, so we leave it off.
 *
 *  Supabase URL shape:
 *    .../storage/v1/object/public/<bucket>/<path>
 *  Transformed shape:
 *    .../storage/v1/render/image/public/<bucket>/<path>?width=N&quality=75
 */
export function toThumbnailUrl(src: string | undefined, targetWidth: number): string | undefined {
  if (!src) return src;
  if (!/^https?:\/\//i.test(src)) return src;
  if (!src.includes("/storage/v1/object/public/")) return src;
  const w = Math.max(100, Math.min(1280, Math.ceil(targetWidth / 100) * 100));
  const transformed = src.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${w}&quality=75`;
}

// Finding the Supabase Storage objects a resource points at.
//
// Nothing records which files belong to which resource. `uploadImageBytes`
// returns a public URL and that string is then written into whatever was being
// saved — a slide's `src`, a run's `output`, a `generated_images.data_url` —
// and the object path is never stored as a column anywhere. So the only way to
// know what a resource owns is to read the resource and pull the URLs back out
// of it.
//
// That is why deletion has to extract BEFORE it deletes: the row is the sole
// index of its own files, and once it is gone nothing will ever look for them
// again. See app/api/resources/delete.
//
// No "use client" and no imports: pure string work, safe from either side.

/** A parsed reference to one object in one bucket. */
export interface StorageRef {
  bucket: string;
  /** Path within the bucket, e.g. "1786..._a1b2c3_ai.png". */
  path: string;
}

/**
 * The buckets a resource can own files in.
 *
 * `avatars` is deliberately absent: a profile photo belongs to the person, not
 * to any resource, and PersonalInfoSection already manages its own cleanup.
 */
export const RESOURCE_BUCKETS = ["images", "audio", "video"] as const;

/*
 * Both shapes a stored Supabase URL can take.
 *
 *   /storage/v1/object/public/<bucket>/<path>
 *   /storage/v1/render/image/public/<bucket>/<path>?width=...
 *
 * The second is the image-transformation endpoint that toThumbnailUrl() writes
 * (app/lib/imageUrl.ts). Both must be recognised and must normalise to the SAME
 * ref, or a file referenced one way and checked the other looks unreferenced
 * and gets deleted while still in use.
 */
const STORAGE_URL = /\/storage\/v1\/(?:object|render\/image)\/public\/([a-z0-9._-]+)\/([^"'\s)\\?#]+)/gi;

/** Every Storage object referenced anywhere in a blob of text or JSON.
 *
 *  Takes text rather than a typed shape on purpose: a run's `output` is markdown
 *  or serialised JSON depending on the tool, and a deck's `slides` is deeply
 *  nested with URLs on images, audio, video, backgroundImage and backgroundArt.
 *  Scanning the serialised form finds all of them without having to keep a
 *  parser in step with every tool's output format. */
export function extractStorageRefs(...sources: (string | null | undefined)[]): StorageRef[] {
  const seen = new Map<string, StorageRef>();

  for (const source of sources) {
    if (!source) continue;
    // A fresh lastIndex per source: the regex is global and shared.
    STORAGE_URL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STORAGE_URL.exec(source)) !== null) {
      const bucket = m[1];
      // Percent-encoded paths survive a round trip through JSON; decode so the
      // ref matches what Storage actually calls the object. A malformed escape
      // is not worth throwing over — fall back to the raw match.
      let path: string;
      try {
        path = decodeURIComponent(m[2]);
      } catch {
        path = m[2];
      }
      if (!path) continue;
      seen.set(`${bucket}/${path}`, { bucket, path });
    }
  }

  return [...seen.values()];
}

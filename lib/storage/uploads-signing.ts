/**
 * Render-time signing for objects in the PRIVATE uploads bucket
 * (crew delivery/pickup proof photos).
 *
 * Bug #62 (operator variant): the crew actions historically stored
 * `getPublicUrl()` links, but `uploads` is private by design
 * (phase0_security) — public-URL links into a private bucket return
 * 400, so every stored photo rendered broken. The actions now store
 * the storage PATH; this module turns a stored value (new path shape
 * OR legacy public-URL shape) into a short-lived signed URL at render.
 *
 * Signing runs through whatever Supabase client the caller already
 * holds: the org member's own client on operator/crew surfaces (the
 * "Org members can read their folder" storage policy authorizes it)
 * or the admin client on the portal-token path. No module state, no
 * secrets — keep it import-safe for unit tests.
 */

type SignedUrlsResult = {
  data: { path: string | null; signedUrl: string }[] | null;
  error: { message: string } | null;
};

/** Minimal structural surface shared by the ssr server client and the
 *  admin client — exactly what batch signing needs. */
export type UploadsSigner = {
  storage: {
    from(bucket: string): {
      createSignedUrls(paths: string[], expiresIn: number): Promise<SignedUrlsResult>;
    };
  };
};

export function uploadsBucket(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET || "uploads";
}

/**
 * Resolve a stored photo value to its uploads-bucket object path.
 *  - bare storage path (new shape)            → as-is
 *  - public URL into the uploads bucket (legacy) → extracted path
 *  - any other URL                             → null (not ours to sign)
 */
export function uploadsObjectPath(
  stored: string | null | undefined,
  bucket: string = uploadsBucket(),
): string | null {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = stored.indexOf(marker);
    return idx === -1 ? null : stored.slice(idx + marker.length);
  }
  return stored;
}

const DEFAULT_TTL_SECONDS = 3600;

/**
 * Batch-resolve stored photo values to renderable URLs (positional).
 *  - uploads-bucket values → signed URL (or null if signing fails)
 *  - foreign http(s) URLs  → passed through unchanged
 *  - null/undefined        → null
 * One storage API call regardless of input size; never throws — a
 * photo that can't be signed renders as "no photo", not a 500.
 */
export async function resolveUploadsPhotoUrls(
  client: UploadsSigner,
  stored: ReadonlyArray<string | null | undefined>,
  expiresIn: number = DEFAULT_TTL_SECONDS,
): Promise<(string | null)[]> {
  const bucket = uploadsBucket();
  const paths = stored.map((value) => uploadsObjectPath(value, bucket));
  const unique = [...new Set(paths.filter((p): p is string => p !== null))];

  const signedByPath = new Map<string, string>();
  if (unique.length > 0) {
    try {
      const { data } = await client.storage.from(bucket).createSignedUrls(unique, expiresIn);
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
      }
    } catch {
      // fall through — unsignable photos resolve to null below
    }
  }

  return stored.map((value, i) => {
    const path = paths[i];
    if (path) return signedByPath.get(path) ?? null;
    // Foreign URL (not our bucket): pass through untouched.
    if (value && (value.startsWith("http://") || value.startsWith("https://"))) return value;
    return null;
  });
}

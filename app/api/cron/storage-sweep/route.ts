import { NextRequest, NextResponse } from "next/server";
import { getOptionalEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";

// Cron job: sweep orphaned storage objects whose DB row never landed
// (or has been deleted), reclaiming bucket space.
//
// Per-call cleanup already exists in lib/products/image-actions.ts and
// lib/settings/brand-upload-actions.ts (PR 17). This sweep catches the
// rest: orphans from earlier bugs, manual operator deletions, and any
// new failure path that bypasses the per-call cleanup.
//
// Conservative defaults:
//   - Only deletes objects older than 24h, avoiding a race with an
//     in-flight upload whose DB row hasn't landed yet (e.g. user
//     mid-upload, retried request).
//   - Hard cap of 500 deletions per run to bound cron duration and
//     memory.
//   - Logs every decision into app_event_logs so an operator can
//     audit what was removed.

export const maxDuration = 60;

const MAX_DELETES_PER_RUN = 500;
const MIN_AGE_HOURS = 24;

/**
 * List ALL objects in a bucket by walking folders depth-first.
 * Supabase's list() API is paginated and folder-scoped; we flatten
 * the tree here. Bounded by maxObjects so a pathological bucket
 * doesn't blow the cron timeout.
 */
async function listAllObjects(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  rootPrefix: string,
  maxObjects = 50_000
): Promise<Array<{ path: string; createdAt: string | null }>> {
  const out: Array<{ path: string; createdAt: string | null }> = [];
  const queue: string[] = [rootPrefix];
  while (queue.length > 0 && out.length < maxObjects) {
    const prefix = queue.shift()!;
    let offset = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error || !data) break;
      for (const entry of data) {
        const childPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          // Folder
          queue.push(childPath);
        } else {
          out.push({ path: childPath, createdAt: entry.created_at ?? null });
          if (out.length >= maxObjects) break;
        }
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return out;
}

/** Extract the storage path from a Supabase public URL. */
function extractPathFromPublicUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const productImagesBucket =
    getOptionalEnv("NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET") ?? "product-images";
  const uploadsBucket = getOptionalEnv("NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET") ?? "uploads";

  // Build the set of paths still referenced from the DB.
  const referencedPaths = new Set<string>();

  // 1. product_images.image_url
  const { data: productImageRows } = await admin
    .from("product_images")
    .select("image_url")
    .is("deleted_at", null)
    .limit(50_000);
  for (const r of productImageRows ?? []) {
    const path = extractPathFromPublicUrl(r.image_url, productImagesBucket);
    if (path) referencedPaths.add(`${productImagesBucket}:${path}`);
  }

  // 2. organizations.settings.brand_logo_url / hero_image_url (both
  //    historically uploaded to the product-images bucket).
  const { data: orgs } = await admin
    .from("organizations")
    .select("settings")
    .is("deleted_at", null)
    .limit(50_000);
  for (const r of orgs ?? []) {
    const settings = (r.settings as Record<string, unknown> | null) ?? {};
    for (const key of ["brand_logo_url", "hero_image_url"]) {
      const url = typeof settings[key] === "string" ? (settings[key] as string) : null;
      const path = extractPathFromPublicUrl(url, productImagesBucket);
      if (path) referencedPaths.add(`${productImagesBucket}:${path}`);
    }
  }

  // 3. route_stops.proof_photo_url + pickup_photo_url (uploads bucket).
  // Sprint 5.5 added pickup_photo_url for the before/after pair; both
  // columns are loaded in one query to avoid scanning the table twice.
  const { data: stops } = await admin
    .from("route_stops")
    .select("proof_photo_url, pickup_photo_url")
    .or("proof_photo_url.not.is.null,pickup_photo_url.not.is.null")
    .limit(50_000);
  for (const r of stops ?? []) {
    if (r.proof_photo_url) {
      const path = extractPathFromPublicUrl(r.proof_photo_url, uploadsBucket);
      if (path) referencedPaths.add(`${uploadsBucket}:${path}`);
    }
    if (r.pickup_photo_url) {
      const path = extractPathFromPublicUrl(r.pickup_photo_url, uploadsBucket);
      if (path) referencedPaths.add(`${uploadsBucket}:${path}`);
    }
  }

  // 4. Marketplace listing media. New uploads land in the public
  //    market-media bucket (#62), which this sweep never walks — this
  //    query protects any LEGACY `market-listings/…` / `market-proof/…`
  //    files still in uploads from being treated as orphans (#61).
  //    (Evidence/identity live in private buckets, also never walked.)
  const { data: listingMedia } = await admin
    .from("market_listings")
    .select("photo_url, proof_video_url")
    .or("photo_url.not.is.null,proof_video_url.not.is.null")
    .limit(50_000);
  for (const r of listingMedia ?? []) {
    for (const url of [r.photo_url, r.proof_video_url]) {
      const path = extractPathFromPublicUrl(url, uploadsBucket);
      if (path) referencedPaths.add(`${uploadsBucket}:${path}`);
    }
  }

  // Walk both buckets and collect candidate orphans.
  const minAgeMs = MIN_AGE_HOURS * 60 * 60 * 1000;
  const nowMs = Date.now();
  const orphansByBucket = new Map<string, string[]>();

  for (const bucket of [productImagesBucket, uploadsBucket]) {
    const objects = await listAllObjects(admin, bucket, "");
    const orphans: string[] = [];
    for (const obj of objects) {
      const key = `${bucket}:${obj.path}`;
      if (referencedPaths.has(key)) continue;
      const createdMs = obj.createdAt ? new Date(obj.createdAt).getTime() : nowMs;
      if (nowMs - createdMs < minAgeMs) continue; // too young — could be a live upload
      orphans.push(obj.path);
      if (orphans.length >= MAX_DELETES_PER_RUN) break;
    }
    if (orphans.length > 0) orphansByBucket.set(bucket, orphans);
  }

  // Delete in bounded batches.
  let totalDeleted = 0;
  const errors: Array<{ bucket: string; error: string }> = [];
  for (const [bucket, paths] of orphansByBucket) {
    // Supabase storage.remove accepts up to ~100 paths per call comfortably.
    const chunkSize = 100;
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) {
        errors.push({ bucket, error: error.message });
      } else {
        totalDeleted += chunk.length;
      }
    }
  }

  // Audit log so an operator can see what was reclaimed in the last run.
  try {
    await admin.from("app_event_logs").insert({
      source: "cron-storage-sweep",
      action: "sweep_complete",
      status: errors.length > 0 ? "warning" : "info",
      route: "/api/cron/storage-sweep",
      metadata: {
        deleted: totalDeleted,
        per_bucket: Object.fromEntries(
          Array.from(orphansByBucket.entries()).map(([b, p]) => [b, p.length])
        ),
        errors,
      },
    });
  } catch {
    // logging is best-effort
  }

  return NextResponse.json({
    ok: errors.length === 0,
    deleted: totalDeleted,
    perBucket: Object.fromEntries(
      Array.from(orphansByBucket.entries()).map(([b, p]) => [b, p.length])
    ),
    errors,
  });
}

/**
 * Bug #62 (operator variant) — crew proof/pickup photos live in the
 * PRIVATE uploads bucket. Stored values are storage paths (new shape)
 * or legacy getPublicUrl() links; both must resolve to the object path
 * for signing (render) and for the storage-sweep referenced-path set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveUploadsPhotoUrls,
  uploadsObjectPath,
  type UploadsSigner,
} from "../lib/storage/uploads-signing.ts";

const BUCKET = "uploads";

test("uploadsObjectPath: bare storage path passes through", () => {
  assert.equal(
    uploadsObjectPath("proof-photos/org1/stop1-123.jpg", BUCKET),
    "proof-photos/org1/stop1-123.jpg",
  );
});

test("uploadsObjectPath: legacy public URL is extracted", () => {
  assert.equal(
    uploadsObjectPath(
      "https://abc.supabase.co/storage/v1/object/public/uploads/pickup-photos/org1/stop2-9.webp",
      BUCKET,
    ),
    "pickup-photos/org1/stop2-9.webp",
  );
});

test("uploadsObjectPath: foreign URLs and other buckets are not ours", () => {
  assert.equal(uploadsObjectPath("https://example.com/cat.jpg", BUCKET), null);
  assert.equal(
    uploadsObjectPath(
      "https://abc.supabase.co/storage/v1/object/public/product-images/x.jpg",
      BUCKET,
    ),
    null,
  );
  assert.equal(uploadsObjectPath(null, BUCKET), null);
  assert.equal(uploadsObjectPath(undefined, BUCKET), null);
  assert.equal(uploadsObjectPath("", BUCKET), null);
});

function fakeSigner(signable: Set<string>): { client: UploadsSigner; calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    client: {
      storage: {
        from() {
          return {
            async createSignedUrls(paths: string[]) {
              calls.push(paths);
              return {
                data: paths.map((p) => ({
                  path: signable.has(p) ? p : null,
                  signedUrl: signable.has(p) ? `https://signed.example/${p}?token=t` : "",
                })),
                error: null,
              };
            },
          };
        },
      },
    },
  };
}

test("resolveUploadsPhotoUrls: signs paths + legacy URLs, passes foreign URLs, one batch call", async () => {
  const path = "proof-photos/org1/a.jpg";
  const legacy = `https://abc.supabase.co/storage/v1/object/public/uploads/${path}`;
  const foreign = "https://cdn.example.com/img.png";
  const { client, calls } = fakeSigner(new Set([path]));

  const out = await resolveUploadsPhotoUrls(client, [path, legacy, foreign, null]);

  assert.equal(out[0], `https://signed.example/${path}?token=t`);
  assert.equal(out[1], out[0]); // legacy URL resolves to the same object
  assert.equal(out[2], foreign); // not ours — passed through untouched
  assert.equal(out[3], null);
  assert.equal(calls.length, 1); // single batched storage call
  assert.deepEqual(calls[0], [path]); // deduped
});

test("resolveUploadsPhotoUrls: unsignable objects resolve to null, never throw", async () => {
  const { client } = fakeSigner(new Set());
  const out = await resolveUploadsPhotoUrls(client, ["proof-photos/org1/gone.jpg"]);
  assert.deepEqual(out, [null]);

  const throwing: UploadsSigner = {
    storage: {
      from() {
        return {
          async createSignedUrls(): Promise<never> {
            throw new Error("storage down");
          },
        };
      },
    },
  };
  const out2 = await resolveUploadsPhotoUrls(throwing, ["proof-photos/org1/a.jpg"]);
  assert.deepEqual(out2, [null]);
});

test("resolveUploadsPhotoUrls: empty input makes no storage call", async () => {
  const { client, calls } = fakeSigner(new Set());
  const out = await resolveUploadsPhotoUrls(client, [null, undefined]);
  assert.deepEqual(out, [null, null]);
  assert.equal(calls.length, 0);
});

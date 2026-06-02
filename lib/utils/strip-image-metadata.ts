import "server-only";
import sharp from "sharp";

/**
 * Strip EXIF / IPTC / XMP metadata from a user-uploaded image before it lands
 * in a public storage bucket.
 *
 * - Honours EXIF Orientation via `.rotate()` so portraits don't render sideways
 *   after the orientation tag is dropped.
 * - Re-encodes to the original raster format. SVG and other vector formats are
 *   *not* supported and must be rejected upstream — they're a stored-XSS vector,
 *   not a metadata-leak issue.
 *
 * Sharp's default output strips metadata unless `.withMetadata()` is called,
 * so the explicit `.rotate()` + format call is all that's needed.
 */
const SUPPORTED: Record<string, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export type StrippedImage = {
  buffer: Buffer;
  mimeType: string;
  bytes: number;
};

export async function stripImageMetadata(
  file: File,
  declaredMimeType: string
): Promise<StrippedImage> {
  const fmt = SUPPORTED[declaredMimeType];
  if (!fmt) {
    throw new Error(`Unsupported image type for metadata stripping: ${declaredMimeType}`);
  }

  const input = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(input).rotate();
  switch (fmt) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: 90 });
      break;
    case "png":
      pipeline = pipeline.png({ compressionLevel: 8 });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: 90 });
      break;
  }
  const buffer = await pipeline.toBuffer();
  return {
    buffer,
    mimeType: declaredMimeType,
    bytes: buffer.length,
  };
}

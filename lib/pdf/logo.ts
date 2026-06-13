/**
 * Fetch an operator's brand logo (settings.brand_logo_url) and return it
 * as a base64 data URL suitable for jsPDF's addImage in a serverless
 * route. Best-effort: any failure (missing URL, non-image, too large,
 * network error) returns null so the PDF header falls back to the
 * business-name wordmark — a logo is purely additive, never required.
 */
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

export async function fetchLogoDataUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) return null;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

import type { CustomImageSettings } from "@/lib/storefront/sections/content-schemas";

/**
 * Single operator-uploaded image with optional caption (PR-1e custom-image).
 * Uses a plain <img> (not next/image) because the source is an arbitrary
 * operator-supplied public URL outside next.config's remotePatterns — the same
 * pattern category-grid/SectionImageField use for operator images. Renders null
 * when no imageUrl is present (an added-but-not-yet-filled section).
 */
export function PartyClassicCustomImage({
  imageUrl,
  alt,
  caption,
}: CustomImageSettings) {
  const url = imageUrl?.trim();
  if (!url) return null;

  const trimmedCaption = caption?.trim();

  return (
    <section className="st-section">
      <div className="st-container" style={{ maxWidth: 960 }}>
        <figure style={{ margin: 0 }}>
          <div style={{ borderRadius: 12, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt?.trim() ?? ""}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          {trimmedCaption && (
            <figcaption
              className="st-section-sub"
              style={{ marginTop: 8, fontSize: 14, textAlign: "center" }}
            >
              {trimmedCaption}
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  );
}

import type { CustomGallerySettings } from "@/lib/storefront/sections/content-schemas";

/**
 * Operator-curated image gallery (PR-1e custom-gallery). Renders a responsive
 * grid of up to 12 images (the schema bounds the list). Each uses a plain <img>
 * (operator-supplied public URLs outside next.config's remotePatterns — same
 * pattern as category-grid). Renders null when there are no images (an
 * added-but-empty section never shows an empty band).
 */
export function PartyClassicCustomGallery({ images }: CustomGallerySettings) {
  const items = (images ?? []).filter((img) => img.imageUrl?.trim());
  if (items.length === 0) return null;

  return (
    <section className="st-section">
      <div className="st-container">
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {items.map((img, i) => (
            <div
              key={i}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                aspectRatio: "4 / 3",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl.trim()}
                alt={img.alt?.trim() ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

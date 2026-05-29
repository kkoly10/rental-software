import { getContentSettings } from "@/lib/data/content-settings";
import { getTranslator } from "@/lib/i18n/server";

function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

function starString(rating: number): string {
  const safe = Math.max(1, Math.min(5, Math.round(rating || 5)));
  return "★".repeat(safe);
}

// The testimonial shape is intentionally backward-compatible with the existing
// content-settings type — location, eventType, and date are all optional, so
// operators with the prior shape keep working and the new fields just enrich
// the card when present.
type ExtendedTestimonial = {
  name: string;
  text: string;
  rating: number;
  location?: string;
  eventType?: string;
  date?: string;
};

export async function PartyClassicReviewsCards() {
  const [contentSettings, { messages: m, t }] = await Promise.all([
    getContentSettings(),
    getTranslator(),
  ]);
  const all = (contentSettings.testimonials as ExtendedTestimonial[]) ?? [];
  if (all.length === 0) return null;

  // Display three cards; if the operator has more, the "Read 500+ reviews"
  // link points at the wider proof — for now just /contact.
  const display = all.slice(0, 3);

  return (
    <section className="st-container st-section">
      <div className="st-section-head">
        <div>
          <h2 className="st-section-title">{m.storefront.testimonials.titleVertical}</h2>
          <p className="st-section-sub">{m.storefront.testimonials.subtitleVertical}</p>
        </div>
        {all.length > 3 && (
          <a href="/contact" className="st-section-link">
            {m.storefront.testimonials.readMoreLink}
          </a>
        )}
      </div>

      <div className="st-reviews-grid">
        {display.map((r, i) => {
          const meta = t(m.storefront.testimonials.eventInline, {
            location: r.location ?? "",
            eventType: r.eventType ?? "",
            date: r.date ?? "none",
          });
          // The compiled meta string can still have leading/trailing
          // separators when location/eventType are missing — collapse them.
          const cleanedMeta = meta
            .replace(/^[\s·]+/, "")
            .replace(/[\s·]+$/, "")
            .replace(/ ·  ·/g, " ·");
          return (
            <div key={`${r.name}-${i}`} className="st-review-card">
              <div className="st-review-stars">{starString(r.rating)}</div>
              <p className="st-review-text">&ldquo;{r.text}&rdquo;</p>
              <div className="st-review-author">
                <div className="st-review-avatar">{initialsFor(r.name)}</div>
                <div>
                  <div className="st-review-name">{r.name}</div>
                  {cleanedMeta && <div className="st-review-meta">{cleanedMeta}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

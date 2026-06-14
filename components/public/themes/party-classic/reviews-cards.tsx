import Link from "next/link";
import { getContentSettings } from "@/lib/data/content-settings";
import { getTranslator } from "@/lib/i18n/server";

type ExtendedTestimonial = {
  name: string;
  text: string;
  rating: number;
  location?: string;
  eventType?: string;
  date?: string;
};

/**
 * Picks the testimonial used in the editorial pull-quote. Highest
 * rating first; ties broken by longest body so we surface the
 * testimonial with the most substance. We DON'T pick by recency —
 * a sharper quote from a year ago beats a flat quote from last week.
 */
function pickFeatured(all: ExtendedTestimonial[]): ExtendedTestimonial | null {
  if (all.length === 0) return null;
  return [...all].sort((a, b) => {
    const ra = Math.max(0, Math.min(5, a.rating || 0));
    const rb = Math.max(0, Math.min(5, b.rating || 0));
    if (rb !== ra) return rb - ra;
    return (b.text?.length ?? 0) - (a.text?.length ?? 0);
  })[0];
}

/**
 * Splits the quote body into {lead, italic, tail} for editorial
 * emphasis. Heuristic: take the shortest comma-separated fragment
 * between 8 and 60 chars; italicize it. Returns lead+tail with empty
 * italic when no good fragment exists.
 */
function splitForEmphasis(text: string): { lead: string; italic: string; tail: string } {
  const trimmed = text.trim().replace(/^[“"”]/, "").replace(/[“"”]$/, "");
  const parts = trimmed.split(/([,\.\!\?] )/g);
  // parts[i] alternates: phrase, delim, phrase, delim, ...
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || /[,\.\!\?] /.test(p)) continue;
    if (p.length >= 8 && p.length <= 60 && /\w/.test(p)) {
      const lead = parts.slice(0, i).join("");
      const italic = p;
      const tail = parts.slice(i + 1).join("");
      // Don't italicize when it would swallow the whole quote.
      if (lead.length > 0 || tail.length > 0) {
        return { lead, italic, tail };
      }
    }
  }
  return { lead: trimmed, italic: "", tail: "" };
}

// Only render a star row for a genuine operator-set rating (1–5). A blank,
// zero, or invalid rating returns "" so we DON'T fabricate a perfect score —
// testimonials are operator-authored, and inventing 5 stars reads as fake
// social proof. Mirrors the dashboard editor, which only shows stars when
// rating > 0.
function starString(rating: number): string {
  if (!Number.isFinite(rating) || rating < 1) return "";
  const safe = Math.min(5, Math.round(rating));
  return "★ ".repeat(safe).trim();
}

/**
 * Editorial reviews — ONE centered pull-quote, not three chip cards.
 * Picks the highest-rated, most substantive testimonial. Renders only
 * when content_settings.testimonials has at least one entry.
 *
 * Per spec §5.7.
 */
/**
 * Optional per-section content override from the storefront page document
 * (PR-1d). When `testimonials` is provided (non-empty) it wins; when ABSENT the
 * component falls back to EXACTLY today's getContentSettings().testimonials, so
 * an org with no document renders byte-for-byte what it does today.
 */
export type PartyClassicReviewsCardsProps = {
  testimonials?: { name: string; text: string; rating?: number }[];
};

export async function PartyClassicReviewsCards({
  testimonials: testimonialsProp,
}: PartyClassicReviewsCardsProps = {}) {
  const [contentSettings, { messages: m }] = await Promise.all([
    getContentSettings(),
    getTranslator(),
  ]);
  const all = (
    testimonialsProp && testimonialsProp.length > 0
      ? testimonialsProp
      : ((contentSettings.testimonials as ExtendedTestimonial[]) ?? [])
  ) as ExtendedTestimonial[];
  const featured = pickFeatured(all);
  if (!featured) return null;

  const { lead, italic, tail } = splitForEmphasis(featured.text);
  const stars = starString(featured.rating);

  const attrPieces: string[] = [featured.name];
  if (featured.location) attrPieces.push(featured.location);
  if (featured.date) attrPieces.push(featured.date);
  const attr = attrPieces.join(" · ");

  return (
    <section className="st-section st-section-rule st-quote">
      <div className="st-container st-quote-inner">
        {stars && (
          <div className="st-quote-stars" aria-hidden="true">
            {stars}
          </div>
        )}
        <p className="st-quote-text">
          &ldquo;{lead}
          {italic && <em>{italic}</em>}
          {tail}&rdquo;
        </p>
        <div className="st-quote-attr">{attr}</div>
        {all.length > 1 && (
          <Link href="/contact" className="st-text-link st-quote-link">
            {m.storefront.testimonials.readMoreLink} →
          </Link>
        )}
      </div>
    </section>
  );
}

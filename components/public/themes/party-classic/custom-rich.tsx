import type { CustomRichSettings } from "@/lib/storefront/sections/content-schemas";

/**
 * Operator-authored PLAIN-text block (PR-1e custom-rich). Renders an optional
 * heading + a body whose newlines are preserved (white-space: pre-line). The
 * body is NOT interpreted as HTML/markdown — React escapes it, so an operator
 * can't inject markup. Renders null when neither field is present so an
 * added-but-empty section never shows an empty band.
 */
export function PartyClassicCustomRich({
  heading,
  body,
}: CustomRichSettings) {
  const trimmedHeading = heading?.trim();
  const trimmedBody = body?.trim();
  if (!trimmedHeading && !trimmedBody) return null;

  return (
    <section className="st-section">
      <div className="st-container" style={{ maxWidth: 760 }}>
        {trimmedHeading && (
          <h2 className="st-section-title">{trimmedHeading}</h2>
        )}
        {trimmedBody && (
          <p className="st-section-sub" style={{ whiteSpace: "pre-line" }}>
            {trimmedBody}
          </p>
        )}
      </div>
    </section>
  );
}

import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

/**
 * Editorial closing — one display-serif statement on cream, one outlined
 * ghost button. Explicitly NOT a gradient banner. The i18n keys reuse
 * existing storefront copy ('checkAvailability') so this component ships
 * without an i18n change in PR 1; tighter copy lands with PR 3.
 */
/**
 * Optional content overrides (PR-1f on-canvas editor). When ALL are absent the
 * render is byte-for-byte identical to today's: the two-part display statement
 * (`headlineLead` + emphasized `headlineEmphasis`) and the `checkAvailability`
 * ghost button — no body paragraph. A present `heading` replaces the two-part
 * statement with a single plain line; a present `body` adds a paragraph (only
 * then); `buttonLabel` overrides the ghost-button text.
 */
export async function PartyClassicClosing({
  heading,
  body,
  buttonLabel,
}: {
  heading?: string;
  body?: string;
  buttonLabel?: string;
} = {}) {
  const m = await getMessages();
  return (
    <section className="st-section st-section-soft" aria-labelledby="st-closing-headline">
      <div className="st-container" style={{ textAlign: "center" }}>
        <p id="st-closing-headline" className="st-display">
          {heading ? (
            heading
          ) : (
            <>
              {m.storefront.closing.headlineLead} <em>{m.storefront.closing.headlineEmphasis}</em>
            </>
          )}
        </p>
        {body && <p className="st-closing-body">{body}</p>}
        <Link href="/inventory" className="st-ghost-btn">
          {buttonLabel || m.storefront.hero.checkAvailability}
        </Link>
      </div>
    </section>
  );
}

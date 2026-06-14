import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

/**
 * Editorial closing — one display-serif statement on cream, one outlined
 * ghost button. Explicitly NOT a gradient banner. The i18n keys reuse
 * existing storefront copy ('checkAvailability') so this component ships
 * without an i18n change in PR 1; tighter copy lands with PR 3.
 */
export async function PartyClassicClosing() {
  const m = await getMessages();
  return (
    <section className="st-section st-section-soft" aria-labelledby="st-closing-headline">
      <div className="st-container" style={{ textAlign: "center" }}>
        <p id="st-closing-headline" className="st-display">
          {m.storefront.closing.headlineLead} <em>{m.storefront.closing.headlineEmphasis}</em>
        </p>
        <Link href="/inventory" className="st-ghost-btn">
          {m.storefront.hero.checkAvailability}
        </Link>
      </div>
    </section>
  );
}

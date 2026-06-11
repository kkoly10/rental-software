import { getMessages } from "@/lib/i18n/server";
import { SectionHead } from "@/components/public/themes/party-classic/section-head";

/**
 * Editorial how-it-works — three blocks with italic serif numerals
 * (01 02 03) in the accent color, no orange filled circles.
 *
 * Per spec docs/design/storefront-editorial.md §5.6.
 */
export async function HowItWorks() {
  const m = await getMessages();
  const steps = m.storefront.howItWorks.steps;

  return (
    <section className="st-section st-section-rule st-how">
      <div className="st-container">
        <SectionHead
          center
          kicker={m.storefront.howItWorks.kicker}
          title={m.storefront.howItWorks.title}
        />
        <div className="st-how-grid">
          {steps.map((step, index) => (
            <article key={step.title} className="st-step">
              <div className="st-step-num">{String(index + 1).padStart(2, "0")}</div>
              <div className="st-step-title">{step.title}</div>
              <p className="st-step-body">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

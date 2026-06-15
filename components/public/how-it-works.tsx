import { getMessages } from "@/lib/i18n/server";
import { SectionHead } from "@/components/public/themes/party-classic/section-head";

/**
 * Editorial how-it-works — three blocks with italic serif numerals
 * (01 02 03) in the accent color, no orange filled circles.
 *
 * Per spec docs/design/storefront-editorial.md §5.6.
 */
export async function HowItWorks({
  heading,
  intro,
  steps: stepsOverride,
}: {
  heading?: string;
  intro?: string;
  steps?: { title: string; description: string }[];
} = {}) {
  const m = await getMessages();
  // Override the whole step list only when a non-empty override is supplied;
  // otherwise fall back to today's i18n steps (byte-for-byte).
  const steps =
    stepsOverride && stepsOverride.length > 0
      ? stepsOverride
      : m.storefront.howItWorks.steps;

  return (
    <section className="st-section st-section-rule st-how">
      <div className="st-container">
        <SectionHead
          center
          kicker={m.storefront.howItWorks.kicker}
          title={heading || m.storefront.howItWorks.title}
          sub={intro || undefined}
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

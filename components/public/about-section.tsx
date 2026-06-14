import { getMessages } from "@/lib/i18n/server";

interface AboutSectionProps {
  text: string;
  /**
   * Optional per-section heading override from the storefront page document
   * (PR-1c). When absent the section title falls back EXACTLY to today's i18n
   * default (m.storefront.about.title), so existing renders are unchanged.
   */
  heading?: string;
}

/**
 * Editorial About section. Renders only when the operator has both
 * written an aboutText and turned on vis.about_section (default off).
 * Centered Fraunces body over a small tracked-uppercase kicker.
 */
export async function AboutSection({ text, heading }: AboutSectionProps) {
  if (!text) return null;
  const m = await getMessages();
  const title = heading?.trim() || m.storefront.about.title;
  const paragraphs = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <section className="st-about-section">
      <div className="st-container st-about-inner">
        <span className="st-eyebrow">{m.storefront.about.kicker}</span>
        <h2 className="st-section-title">{title}</h2>
        <div className="st-about-body">
          {paragraphs.map((line, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : "16px 0 0" }}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

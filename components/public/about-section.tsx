import { getMessages } from "@/lib/i18n/server";

interface AboutSectionProps {
  text: string;
}

export async function AboutSection({ text }: AboutSectionProps) {
  if (!text) return null;
  const m = await getMessages();
  const lines = text.split("\n");

  return (
    <section className="section about-section">
      <div className="container">
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div className="kicker">{m.storefront.about.kicker}</div>
          <h2 style={{ margin: "8px 0 24px" }}>{m.storefront.about.title}</h2>
          <div className="about-section-text">
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

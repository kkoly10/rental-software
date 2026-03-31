interface AboutSectionProps {
  text: string;
}

export function AboutSection({ text }: AboutSectionProps) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <section className="section about-section">
      <div className="container">
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div className="kicker">Our story</div>
          <h2 style={{ margin: "8px 0 24px" }}>About Our Business</h2>
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

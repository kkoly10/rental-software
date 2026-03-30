const benefits = [
  {
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
    title: "Book in Under 2 Minutes",
    description:
      "Your customers pick a date, choose their rental, and pay a deposit — all from their phone. No phone calls needed.",
  },
  {
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    title: "Everything in One Place",
    description:
      "Orders, payments, availability, delivery routes, and customer records — one dashboard instead of five apps.",
  },
  {
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    title: "Get Paid Faster",
    description:
      "Automatic invoices, deposit tracking, and balance-due reminders so you stop chasing payments manually.",
  },
];

export function BenefitsSection() {
  return (
    <section className="section benefits-section">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 36px" }}>
          <div className="kicker">Why operators switch</div>
          <h2 style={{ margin: "8px 0 0" }}>
            Built for rental businesses, not generic booking
          </h2>
        </div>

        <div className="grid grid-3">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="benefit-card panel">
              <div
                className="benefit-icon"
                dangerouslySetInnerHTML={{ __html: benefit.icon }}
              />
              <h3 style={{ margin: "16px 0 8px", fontSize: "1.1rem" }}>
                {benefit.title}
              </h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                {benefit.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

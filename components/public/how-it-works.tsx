const steps = [
  {
    title: "Choose Your Rentals",
    description: "Browse bounce houses, water slides, and party add-ons that fit your event.",
  },
  {
    title: "Select Date, Time & Delivery Area",
    description: "Enter your event date/time and ZIP code so we can confirm availability and delivery.",
  },
  {
    title: "Reserve Online & Get Ready",
    description: "Reserve in minutes, then our team delivers, sets up safely, and handles pickup after the event.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="kicker">How it works</div>
            <h2>Fast booking without the guesswork</h2>
          </div>
        </div>

        <div className="grid grid-3">
          {steps.map((step, index) => (
            <article key={step.title} className="panel">
              <div className="badge" style={{ marginBottom: 14 }}>{index + 1}</div>
              <h3 style={{ margin: "0 0 8px" }}>{step.title}</h3>
              <div className="muted">{step.description}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

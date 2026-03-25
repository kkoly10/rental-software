const steps = [
  {
    title: "Pick Your Date",
    description: "Check live availability for your event window and delivery area.",
  },
  {
    title: "Choose Your Fun",
    description: "Compare inflatables, packages, and add-ons that fit your party size.",
  },
  {
    title: "We Deliver",
    description: "Our team brings it out, sets it up, and returns for pickup later.",
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

import { getMessages } from "@/lib/i18n/server";

export async function HowItWorks() {
  const m = await getMessages();
  const steps = m.storefront.howItWorks.steps;

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="kicker">{m.storefront.howItWorks.kicker}</div>
            <h2>{m.storefront.howItWorks.title}</h2>
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

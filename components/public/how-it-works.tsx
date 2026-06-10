import { getMessages } from "@/lib/i18n/server";

export async function HowItWorks() {
  const m = await getMessages();
  const steps = m.storefront.howItWorks.steps;

  return (
    <section className="st-section st-hiw">
      <div className="st-container">
        <div className="st-section-head st-section-head-center">
          <div>
            <span className="st-section-kicker">{m.storefront.howItWorks.kicker}</span>
            <h2 className="st-section-title">{m.storefront.howItWorks.title}</h2>
          </div>
        </div>

        <div className="st-hiw-grid">
          {steps.map((step, index) => (
            <article key={step.title} className="st-hiw-card">
              <div className="st-hiw-num">{index + 1}</div>
              <h3 className="st-hiw-title">{step.title}</h3>
              <p className="st-hiw-desc">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

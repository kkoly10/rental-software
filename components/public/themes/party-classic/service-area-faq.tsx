"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface ServiceAreaItem {
  id: string;
  zipCode: string;
  city?: string | null;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface Props {
  areas: ServiceAreaItem[];
  faqs: FaqItem[];
}

/**
 * Carnival-theme service-area + FAQ pair, side-by-side on desktop and
 * stacked on mobile. The data is fetched by the server-rendered parent
 * (so the FaqSection's client-side useI18n stays available here as well).
 */
export function PartyClassicServiceAreaFaq({ areas, faqs }: Props) {
  const { messages: m } = useI18n();
  // Default to the first FAQ open, matching the mockup.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (areas.length === 0 && faqs.length === 0) return null;

  const displayLimit = 6;
  const displayed = areas.slice(0, displayLimit);
  const remaining = areas.length - displayed.length;

  return (
    <section className="st-section st-section-card">
      <div className="st-container st-svc-faq">
        {areas.length > 0 && (
          <div>
            <span className="st-section-kicker">{m.storefront.serviceArea.kicker}</span>
            <h2 className="st-section-title" style={{ fontSize: 30 }}>
              {m.storefront.serviceArea.title}
            </h2>
            <p className="st-section-sub" style={{ marginBottom: 20 }}>
              {m.storefront.serviceArea.description}
            </p>
            <div className="st-zip-grid">
              {displayed.map((a) => (
                <span key={a.id} className="st-zip-pill">
                  <span>
                    <span style={{ fontFamily: "var(--st-font-display)", fontWeight: 600 }}>{a.zipCode}</span>
                    {a.city && (
                      <span style={{ display: "block", fontSize: 13, color: "var(--st-muted-2)" }}>
                        {a.city}
                      </span>
                    )}
                  </span>
                </span>
              ))}
              {remaining > 0 && (
                <span className="st-zip-pill more">+{remaining} more</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--st-muted-2)", marginTop: 14, fontStyle: "italic" }}>
              {m.storefront.serviceArea.notListed}
            </p>
          </div>
        )}

        {faqs.length > 0 && (
          <div>
            <span className="st-section-kicker">{m.storefront.faq.kicker}</span>
            <h2 className="st-section-title" style={{ fontSize: 30, marginBottom: 20 }}>
              {m.storefront.faq.title}
            </h2>
            <div className="st-svc-faq-faq-list">
              {faqs.map((f, i) => {
                const isOpen = openIndex === i;
                return (
                  <div key={`${i}:${f.question}`} className="st-svc-faq-item">
                    <button
                      type="button"
                      className="st-svc-faq-trigger"
                      aria-expanded={isOpen}
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                    >
                      <span className="st-svc-faq-q">{f.question}</span>
                      <span className="st-svc-faq-toggle" aria-hidden="true">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && <p className="st-svc-faq-a">{f.answer}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

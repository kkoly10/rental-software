"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface FaqSectionProps {
  customFaqs: { question: string; answer: string }[];
}

/**
 * Editorial FAQ — two-column on desktop (5fr intro / 7fr accordion),
 * stacks on mobile. Hairline-separated single-column accordion list,
 * minus/plus glyph (no chevron SVG), Fraunces questions.
 *
 * Per spec §5.9.
 */
export function FaqSection({ customFaqs }: FaqSectionProps) {
  const { messages: m } = useI18n();
  const faqs = customFaqs;
  // Mirror the mockup: first item open by default. Users can collapse all.
  const [openIndex, setOpenIndex] = useState<number | null>(faqs.length > 0 ? 0 : null);

  if (faqs.length === 0) return null;

  return (
    <section className="st-section st-section-rule st-faq">
      <div className="st-container st-faq-grid">
        <div>
          <span className="st-eyebrow">{m.storefront.faq.kicker}</span>
          <h2 className="st-section-title st-faq-title">{m.storefront.faq.title}</h2>
        </div>
        <div className="st-faq-list">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={`${index}:${faq.question}`} className="st-faq-item">
                <button
                  type="button"
                  className="st-faq-trigger"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="st-faq-q">{faq.question}</span>
                  <span className="st-faq-toggle" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && <p className="st-faq-a">{faq.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface FaqSectionProps {
  customFaqs: { question: string; answer: string }[];
}

export function FaqSection({ customFaqs }: FaqSectionProps) {
  const { messages: m } = useI18n();
  const faqs = customFaqs;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (faqs.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 36px" }}>
          <div className="kicker">{m.storefront.faq.kicker}</div>
          <h2 style={{ margin: "8px 0 0" }}>
            {m.storefront.faq.title}
          </h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={faq.question} className="faq-item">
              <button
                type="button"
                className="faq-trigger"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
              >
                <span>{faq.question}</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: "transform 0.2s ease",
                    transform: openIndex === index ? "rotate(180deg)" : "rotate(0)",
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

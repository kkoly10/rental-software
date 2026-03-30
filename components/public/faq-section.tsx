"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does the booking process work?",
    answer:
      "Customers visit your storefront, pick a date and ZIP code, choose their rentals from your available inventory, and submit a booking request. You get an instant notification and can confirm, send a quote, or follow up — all from your dashboard.",
  },
  {
    question: "How do deposits and payments work?",
    answer:
      "You set your own deposit amounts and payment terms. When a booking comes in, the system tracks the deposit due, records payments as they come in (cash, card, Venmo, Zelle), and shows the remaining balance at a glance. Automated invoice PDFs are generated for every order.",
  },
  {
    question: "What happens if a customer needs to cancel?",
    answer:
      "You control your cancellation policy. When you cancel an order from the dashboard, the system automatically releases the availability block so other customers can book that date. Refund tracking is built in.",
  },
  {
    question: "How do you prevent double-bookings?",
    answer:
      "Every confirmed order automatically blocks that product on that date. The availability engine checks for conflicts in real-time — during online checkout and when you create orders from the dashboard. You can also manually block dates for maintenance or private events.",
  },
  {
    question: "What about delivery and setup?",
    answer:
      "The platform includes delivery route management with stop-by-stop tracking. Your crew can access a mobile-friendly view for the day's deliveries. Setup, safety review, and pickup times are tracked per order.",
  },
  {
    question: "What if it rains on the event day?",
    answer:
      "Weather policies are up to you as the operator. Many rental businesses offer a reschedule option for severe weather. The system makes it easy to move an order to a new date and the availability engine handles the rest.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="section">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 36px" }}>
          <div className="kicker">Common questions</div>
          <h2 style={{ margin: "8px 0 0" }}>
            Everything you need to know
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

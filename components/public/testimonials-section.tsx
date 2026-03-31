interface TestimonialsSectionProps {
  testimonials: { name: string; text: string; rating: number }[];
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="section testimonials-section">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 36px" }}>
          <div className="kicker">Reviews</div>
          <h2 style={{ margin: "8px 0 0" }}>What our customers say</h2>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-stars">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span
                    key={s}
                    className="testimonial-star"
                    style={{ opacity: s < t.rating ? 1 : 0.25 }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <blockquote>&ldquo;{t.text}&rdquo;</blockquote>
              <div className="testimonial-name">{t.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

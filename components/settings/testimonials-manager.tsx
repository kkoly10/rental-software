"use client";

import { useActionState, useState } from "react";
import { updateTestimonials } from "@/lib/settings/content-actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

type Testimonial = { name: string; text: string; rating: number };

const initialState = { ok: false, message: "" };

function StarSelector({
  rating,
  onChange,
  starTitleTemplate,
  starsTitleTemplate,
}: {
  rating: number;
  onChange: (r: number) => void;
  starTitleTemplate: string;
  starsTitleTemplate: string;
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`content-editor-star ${star <= rating ? "active" : ""}`}
          onClick={() => onChange(star)}
          title={formatMessage(
            star > 1 ? starsTitleTemplate : starTitleTemplate,
            { count: star }
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function TestimonialsManager({ defaults }: { defaults: Testimonial[] }) {
  const [items, setItems] = useState<Testimonial[]>(
    defaults.length > 0 ? defaults : []
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(updateTestimonials, initialState);
  const { messages } = useI18n();
  const m = messages.forms.testimonials;

  function addItem() {
    setItems([...items, { name: "", text: "", rating: 5 }]);
    setExpandedIndex(items.length);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setExpandedIndex(null);
  }

  function updateItem(index: number, field: keyof Testimonial, value: string | number) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="testimonials_json" value={JSON.stringify(items)} />

      <div className="content-editor-list">
        {items.map((item, index) => (
          <div key={index} className="content-editor-item">
            <div
              className="content-editor-item-header"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              style={{ cursor: "pointer" }}
            >
              <div>
                <strong>
                  {item.name || formatMessage(m.defaultTitle, { index: index + 1 })}
                </strong>
                {item.rating > 0 && (
                  <span style={{ marginLeft: 8, color: "var(--warning)", fontSize: 13 }}>
                    {"★".repeat(item.rating)}
                  </span>
                )}
              </div>
              <div className="content-editor-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                  style={{ color: "var(--danger)" }}
                  title={m.deleteTitle}
                >
                  ✕
                </button>
              </div>
            </div>

            {expandedIndex === index && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.customerNameLabel}</span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    placeholder={m.customerNamePlaceholder}
                    style={{ marginTop: 4, width: "100%" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.reviewTextLabel}</span>
                  <textarea
                    value={item.text}
                    onChange={(e) => updateItem(index, "text", e.target.value)}
                    placeholder={m.reviewTextPlaceholder}
                    rows={3}
                    style={{
                      marginTop: 4,
                      width: "100%",
                      fontFamily: "inherit",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  />
                </label>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.ratingLabel}</span>
                  <div style={{ marginTop: 4 }}>
                    <StarSelector
                      rating={item.rating}
                      onChange={(r) => updateItem(index, "rating", r)}
                      starTitleTemplate={m.starTitle}
                      starsTitleTemplate={m.starsTitle}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="content-editor-add-btn" onClick={addItem}>
        {m.addButton}
      </button>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}

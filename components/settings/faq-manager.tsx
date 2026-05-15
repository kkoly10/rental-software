"use client";

import { useActionState, useState } from "react";
import { updateFaqContent } from "@/lib/settings/content-actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

type FaqItem = { question: string; answer: string };

const initialState = { ok: false, message: "" };

export function FaqManager({ defaults }: { defaults: FaqItem[] }) {
  const [items, setItems] = useState<FaqItem[]>(
    defaults.length > 0 ? defaults : []
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(updateFaqContent, initialState);
  const { messages } = useI18n();
  const m = messages.forms.faq;

  function addItem() {
    setItems([...items, { question: "", answer: "" }]);
    setExpandedIndex(items.length);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setExpandedIndex(null);
  }

  function updateItem(index: number, field: keyof FaqItem, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function moveItem(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setExpandedIndex(target);
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="faq_json" value={JSON.stringify(items)} />

      <div className="content-editor-list">
        {items.map((item, index) => (
          <div key={index} className="content-editor-item">
            <div
              className="content-editor-item-header"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              style={{ cursor: "pointer" }}
            >
              <strong>
                {item.question || formatMessage(m.defaultTitle, { index: index + 1 })}
              </strong>
              <div className="content-editor-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); moveItem(index, "up"); }}
                  disabled={index === 0}
                  title={m.moveUpTitle}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); moveItem(index, "down"); }}
                  disabled={index === items.length - 1}
                  title={m.moveDownTitle}
                >
                  ↓
                </button>
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.questionLabel}</span>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateItem(index, "question", e.target.value)}
                    placeholder={m.questionPlaceholder}
                    style={{ marginTop: 4, width: "100%" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.answerLabel}</span>
                  <textarea
                    value={item.answer}
                    onChange={(e) => updateItem(index, "answer", e.target.value)}
                    placeholder={m.answerPlaceholder}
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

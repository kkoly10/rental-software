"use client";

import { useActionState, useState } from "react";
import { updateFaqContent } from "@/lib/settings/content-actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";
import { newStableId } from "@/lib/utils/stable-id";

type FaqItem = { question: string; answer: string };
type FaqEntry = FaqItem & { _id: string };

const initialState = { ok: false, message: "" };

export function FaqManager({ defaults }: { defaults: FaqItem[] }) {
  const [items, setItems] = useState<FaqEntry[]>(() =>
    defaults.map((d) => ({ ...d, _id: newStableId() }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(updateFaqContent, initialState);
  const { messages } = useI18n();
  const m = messages.forms.faq;

  const serialized = JSON.stringify(items.map(({ _id: _, ...rest }) => rest));

  function addItem() {
    const newItem: FaqEntry = { question: "", answer: "", _id: newStableId() };
    setItems([...items, newItem]);
    setExpandedId(newItem._id);
  }

  function removeItem(id: string) {
    setItems(items.filter((it) => it._id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  }

  function updateItem(id: string, field: keyof FaqItem, value: string) {
    setItems(items.map((it) => (it._id === id ? { ...it, [field]: value } : it)));
  }

  function moveItem(id: string, direction: "up" | "down") {
    const index = items.findIndex((it) => it._id === id);
    if (index === -1) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="faq_json" value={serialized} />

      <div className="content-editor-list">
        {items.map((item, index) => (
          <div key={item._id} className="content-editor-item">
            <div
              className="content-editor-item-header"
              onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
              style={{ cursor: "pointer" }}
            >
              <strong>
                {item.question || formatMessage(m.defaultTitle, { index: index + 1 })}
              </strong>
              <div className="content-editor-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); moveItem(item._id, "up"); }}
                  disabled={index === 0}
                  aria-label={m.moveUpTitle} title={m.moveUpTitle}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); moveItem(item._id, "down"); }}
                  disabled={index === items.length - 1}
                  aria-label={m.moveDownTitle} title={m.moveDownTitle}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); removeItem(item._id); }}
                  style={{ color: "var(--danger)" }}
                  aria-label={m.deleteTitle} title={m.deleteTitle}
                >
                  ✕
                </button>
              </div>
            </div>

            {expandedId === item._id && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.questionLabel}</span>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateItem(item._id, "question", e.target.value)}
                    placeholder={m.questionPlaceholder}
                    style={{ marginTop: 4, width: "100%" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.answerLabel}</span>
                  <textarea
                    value={item.answer}
                    onChange={(e) => updateItem(item._id, "answer", e.target.value)}
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

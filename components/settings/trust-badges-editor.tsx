"use client";

import { useActionState, useState } from "react";
import { updateTrustBadges } from "@/lib/settings/content-actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";
import { newStableId } from "@/lib/utils/stable-id";

type TrustBadge = { title: string; description: string };
type TrustBadgeItem = TrustBadge & { _id: string };

const initialState = { ok: false, message: "" };

export function TrustBadgesEditor({ defaults }: { defaults: TrustBadge[] }) {
  const [items, setItems] = useState<TrustBadgeItem[]>(() =>
    defaults.map((d) => ({ ...d, _id: newStableId() }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(updateTrustBadges, initialState);
  const { messages } = useI18n();
  const m = messages.forms.trustBadges;

  const serialized = JSON.stringify(items.map(({ _id: _, ...rest }) => rest));

  function addItem() {
    if (items.length >= 4) return;
    const newItem: TrustBadgeItem = { title: "", description: "", _id: newStableId() };
    setItems([...items, newItem]);
    setExpandedId(newItem._id);
  }

  function removeItem(id: string) {
    setItems(items.filter((it) => it._id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  }

  function updateItem(id: string, field: keyof TrustBadge, value: string) {
    setItems(items.map((it) => (it._id === id ? { ...it, [field]: value } : it)));
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="trust_badges_json" value={serialized} />

      <div className="content-editor-list">
        {items.map((item, index) => (
          <div key={item._id} className="content-editor-item">
            <div
              className="content-editor-item-header"
              onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
              style={{ cursor: "pointer" }}
            >
              <strong>
                {item.title || formatMessage(m.defaultTitle, { index: index + 1 })}
              </strong>
              <div className="content-editor-actions">
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.titleLabel}</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(item._id, "title", e.target.value)}
                    placeholder={m.titlePlaceholder}
                    style={{ marginTop: 4, width: "100%" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>{m.descriptionLabel}</span>
                  <textarea
                    value={item.description}
                    onChange={(e) => updateItem(item._id, "description", e.target.value)}
                    placeholder={m.descriptionPlaceholder}
                    rows={2}
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

      {items.length < 4 && (
        <button type="button" className="content-editor-add-btn" onClick={addItem}>
          {m.addButton}
        </button>
      )}

      <p style={{ fontSize: 12, color: "var(--text-soft)", margin: "4px 0 0" }}>
        {formatMessage(m.limitNote, { count: items.length })}
      </p>

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

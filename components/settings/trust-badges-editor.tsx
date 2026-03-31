"use client";

import { useActionState, useState } from "react";
import { updateTrustBadges } from "@/lib/settings/content-actions";

type TrustBadge = { title: string; description: string };

const initialState = { ok: false, message: "" };

export function TrustBadgesEditor({ defaults }: { defaults: TrustBadge[] }) {
  const [items, setItems] = useState<TrustBadge[]>(
    defaults.length > 0 ? defaults : []
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(updateTrustBadges, initialState);

  function addItem() {
    if (items.length >= 4) return;
    setItems([...items, { title: "", description: "" }]);
    setExpandedIndex(items.length);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setExpandedIndex(null);
  }

  function updateItem(index: number, field: keyof TrustBadge, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="trust_badges_json" value={JSON.stringify(items)} />

      <div className="content-editor-list">
        {items.map((item, index) => (
          <div key={index} className="content-editor-item">
            <div
              className="content-editor-item-header"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              style={{ cursor: "pointer" }}
            >
              <strong>{item.title || `Badge #${index + 1}`}</strong>
              <div className="content-editor-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                  style={{ color: "var(--danger)" }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>

            {expandedIndex === index && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>Title</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(index, "title", e.target.value)}
                    placeholder="e.g. Free Delivery"
                    style={{ marginTop: 4, width: "100%" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-soft)" }}>Description</span>
                  <textarea
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Short description of the badge..."
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
          + Add Trust Badge
        </button>
      )}

      <p style={{ fontSize: 12, color: "var(--text-soft)", margin: "4px 0 0" }}>
        Maximum 4 badges. {items.length}/4 used.
      </p>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Trust Badges"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { updateNavLinks } from "@/lib/settings/content-actions";
import type { NavLink } from "@/lib/data/content-settings";

const initialState = { ok: false, message: "" };

export function NavLinksEditor({ defaults }: { defaults: NavLink[] }) {
  const [links, setLinks] = useState<NavLink[]>(defaults);
  const [state, formAction, pending] = useActionState(updateNavLinks, initialState);

  function toggleVisible(key: string) {
    setLinks((prev) =>
      prev.map((l) => (l.key === key ? { ...l, visible: !l.visible } : l))
    );
  }

  function updateLabel(key: string, label: string) {
    setLinks((prev) =>
      prev.map((l) => (l.key === key ? { ...l, label } : l))
    );
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="nav_links_json" value={JSON.stringify(links)} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        Toggle which links appear in your storefront navigation and customise the labels your customers see.
      </div>

      <div>
        {links.map((link) => (
          <div
            key={link.key}
            className="content-editor-toggle-row"
            style={{ opacity: link.visible ? 1 : 0.55 }}
          >
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="text"
                value={link.label}
                onChange={(e) => updateLabel(link.key, e.target.value)}
                maxLength={30}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  width: "100%",
                  maxWidth: 180,
                  padding: "4px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--surface-muted)",
                }}
              />
              <span className="muted" style={{ fontSize: 12, fontFamily: "monospace" }}>
                {link.href}
              </span>
            </div>
            <label className="sms-toggle">
              <input
                type="checkbox"
                checked={link.visible}
                onChange={() => toggleVisible(link.key)}
              />
              <span className="sms-toggle-slider" />
            </label>
          </div>
        ))}
      </div>

      {state.message && (
        <div
          className={state.ok ? "badge success" : "badge warning"}
          style={{ padding: "10px 14px", marginTop: 12 }}
        >
          {state.message}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Navigation"}
        </button>
      </div>
    </form>
  );
}

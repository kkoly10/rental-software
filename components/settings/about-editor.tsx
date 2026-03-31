"use client";

import { useActionState, useState } from "react";
import { updateAboutContent } from "@/lib/settings/content-actions";

const initialState = { ok: false, message: "" };

export function AboutEditor({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  const [state, formAction, pending] = useActionState(updateAboutContent, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>About your business</strong>
        <textarea
          name="about_text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell customers about your rental business, your history, mission, and what makes you stand out..."
          rows={6}
          style={{
            marginTop: 8,
            width: "100%",
            fontFamily: "inherit",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
        />
        <div className="content-editor-char-count">
          {text.length} characters
        </div>
      </label>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save About"}
        </button>
      </div>
    </form>
  );
}

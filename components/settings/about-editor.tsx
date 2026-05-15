"use client";

import { useActionState, useState } from "react";
import { updateAboutContent } from "@/lib/settings/content-actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const initialState = { ok: false, message: "" };

export function AboutEditor({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  const [state, formAction, pending] = useActionState(updateAboutContent, initialState);
  const { messages } = useI18n();
  const m = messages.forms.about;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>{m.heading}</strong>
        <textarea
          name="about_text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={m.placeholder}
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
          {formatMessage(m.charCount, { count: text.length })}
        </div>
      </label>

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

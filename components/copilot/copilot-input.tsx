"use client";

import { useState } from "react";

export function CopilotInput({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = value.trim();
    if (!msg || disabled) return;
    onSend(msg);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="copilot-input-row">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask a question..."
        disabled={disabled}
        style={{ flex: 1 }}
      />
      <button
        type="submit"
        className="primary-btn"
        disabled={disabled || !value.trim()}
        style={{ padding: "8px 14px", fontSize: 13 }}
      >
        Send
      </button>
    </form>
  );
}

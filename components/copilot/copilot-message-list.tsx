"use client";

import { useEffect, useRef, useState } from "react";
import { renderSafeRichText } from "@/lib/rendering/safe-rich-text";
import { useI18n } from "@/lib/i18n/provider";

export type CopilotMessage = {
  role: "user" | "assistant";
  content: string;
};

export function CopilotMessageList({ messages }: { messages: CopilotMessage[] }) {
  const { messages: m } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="copilot-empty">
        <div style={{ fontSize: 28, marginBottom: 8 }}>&#9889;</div>
        <strong style={{ fontSize: 14 }}>{m.copilot.emptyTitle}</strong>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {m.copilot.emptyBody}
        </div>
      </div>
    );
  }

  return (
    <div className="copilot-messages">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`copilot-msg ${
            msg.role === "user" ? "copilot-msg-user" : "copilot-msg-assistant"
          }`}
        >
          <div className="copilot-msg-content">
            {renderSafeRichText(msg.content)}
          </div>
          {msg.role === "assistant" && <CopyButton text={msg.content} />}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { messages: m } = useI18n();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ghost-btn copilot-msg-copy"
      aria-label={m.copilot.copy}
      style={{ fontSize: 11, padding: "2px 6px", marginTop: 4, opacity: 0.75 }}
    >
      {copied ? m.copilot.copied : m.copilot.copy}
    </button>
  );
}
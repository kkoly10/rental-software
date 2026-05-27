"use client";

import { useEffect, useRef } from "react";
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
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
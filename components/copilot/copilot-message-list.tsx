"use client";

import { useEffect, useRef } from "react";
import { renderSafeRichText } from "@/lib/rendering/safe-rich-text";

export type CopilotMessage = {
  role: "user" | "assistant";
  content: string;
};

export function CopilotMessageList({ messages }: { messages: CopilotMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="copilot-empty">
        <div style={{ fontSize: 28, marginBottom: 8 }}>&#9889;</div>
        <strong style={{ fontSize: 14 }}>Operator Copilot</strong>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Ask me about workflows, features, or what to do next.
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
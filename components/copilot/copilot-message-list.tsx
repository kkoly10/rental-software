"use client";

import { useEffect, useRef } from "react";

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
          className={`copilot-msg ${msg.role === "user" ? "copilot-msg-user" : "copilot-msg-assistant"}`}
        >
          <div
            className="copilot-msg-content"
            dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function formatMessage(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--primary)">$1</a>')
    // Line breaks
    .replace(/\n/g, "<br/>");
}

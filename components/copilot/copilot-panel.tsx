"use client";

import { useState, useCallback } from "react";
import { CopilotMessageList, type CopilotMessage } from "./copilot-message-list";
import { CopilotInput } from "./copilot-input";
import { CopilotSuggestedPrompts } from "./copilot-suggested-prompts";
import { getSuggestedPrompts } from "@/lib/copilot/suggested-prompts";

export function CopilotPanel({
  currentRoute,
  onClose,
}: {
  currentRoute: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const prompts = getSuggestedPrompts(currentRoute);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: CopilotMessage = { role: "user", content };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, route: currentRoute }),
        });
        const data = await res.json();
        const assistantMsg: CopilotMessage = {
          role: "assistant",
          content: data.response ?? "Sorry, I couldn't process that request.",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [currentRoute]
  );

  return (
    <div className="copilot-panel">
      <div className="copilot-panel-header">
        <div>
          <strong style={{ fontSize: 14 }}>Operator Copilot</strong>
          <div className="muted" style={{ fontSize: 12 }}>Read-only assistant</div>
        </div>
        <button
          onClick={onClose}
          className="ghost-btn"
          style={{ fontSize: 18, padding: "2px 8px", lineHeight: 1 }}
        >
          &times;
        </button>
      </div>

      <CopilotMessageList messages={messages} />

      {messages.length === 0 && (
        <CopilotSuggestedPrompts prompts={prompts} onSelect={sendMessage} />
      )}

      <CopilotInput onSend={sendMessage} disabled={loading} />

      {loading && (
        <div className="muted" style={{ textAlign: "center", padding: "6px 0", fontSize: 12 }}>
          Thinking...
        </div>
      )}
    </div>
  );
}

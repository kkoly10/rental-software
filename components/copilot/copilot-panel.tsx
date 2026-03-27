"use client";

import { useCallback, useState } from "react";
import { CopilotMessageList, type CopilotMessage } from "./copilot-message-list";
import { CopilotInput } from "./copilot-input";
import { CopilotSuggestedPrompts } from "./copilot-suggested-prompts";
import { getSuggestedPrompts } from "@/lib/copilot/suggested-prompts";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

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
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMsg: CopilotMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, route: currentRoute }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Copilot could not process your request."
          );
        }

        const assistantMsg: CopilotMessage = {
          role: "assistant",
          content:
            typeof data?.response === "string"
              ? data.response
              : "Sorry, I couldn't process that request.",
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: getErrorMessage(error),
          },
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
          <div className="muted" style={{ fontSize: 12 }}>
            Read-only assistant
          </div>
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
        <div
          className="muted"
          style={{ textAlign: "center", padding: "6px 0", fontSize: 12 }}
        >
          Thinking...
        </div>
      )}
    </div>
  );
}

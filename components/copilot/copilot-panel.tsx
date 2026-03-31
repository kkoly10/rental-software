"use client";

import { useCallback, useState } from "react";
import { CopilotMessageList, type CopilotMessage } from "./copilot-message-list";
import { CopilotInput } from "./copilot-input";
import { CopilotSuggestedPrompts } from "./copilot-suggested-prompts";
import { CopilotActionPreview } from "./copilot-action-preview";
import { getSuggestedPrompts } from "@/lib/copilot/suggested-prompts";
import type { CopilotAction } from "@/lib/copilot/actions";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

/**
 * Parse `[ACTION:{...}]` blocks from an AI response.
 * Returns the cleaned text (without the action block) and the parsed action if found.
 */
function parseActionFromResponse(content: string): {
  text: string;
  action: CopilotAction | null;
} {
  const actionRegex = /\[ACTION:\s*(\{[\s\S]*?\})\s*\]/;
  const match = content.match(actionRegex);

  if (!match) {
    return { text: content, action: null };
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.type && parsed.field && parsed.value) {
      const action: CopilotAction = {
        type: parsed.type,
        field: parsed.field,
        value: parsed.value,
        preview: parsed.preview || "",
      };
      const text = content.replace(actionRegex, "").trim();
      return { text, action };
    }
  } catch {
    // JSON parse failed, treat as normal text
  }

  return { text: content, action: null };
}

type PendingAction = {
  messageIndex: number;
  action: CopilotAction;
};

export function CopilotPanel({
  currentRoute,
  onClose,
}: {
  currentRoute: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const prompts = getSuggestedPrompts(currentRoute);

  const handleApplyAction = useCallback(async (action: CopilotAction) => {
    const res = await fetch("/api/copilot/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      throw new Error(
        typeof data?.message === "string"
          ? data.message
          : "Failed to apply changes."
      );
    }
  }, []);

  const handleDismissAction = useCallback((messageIndex: number) => {
    setPendingActions((prev) =>
      prev.filter((pa) => pa.messageIndex !== messageIndex)
    );
  }, []);

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

        const rawContent =
          typeof data?.response === "string"
            ? data.response
            : "Sorry, I couldn't process that request.";

        const { text, action } = parseActionFromResponse(rawContent);

        const assistantMsg: CopilotMessage = {
          role: "assistant",
          content: text,
        };

        setMessages((prev) => {
          const newMessages = [...prev, assistantMsg];
          if (action) {
            setPendingActions((prevActions) => [
              ...prevActions,
              { messageIndex: newMessages.length - 1, action },
            ]);
          }
          return newMessages;
        });
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
            AI-powered assistant
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

      {pendingActions.map((pa) => (
        <CopilotActionPreview
          key={pa.messageIndex}
          action={pa.action}
          onApply={handleApplyAction}
          onDismiss={() => handleDismissAction(pa.messageIndex)}
        />
      ))}

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

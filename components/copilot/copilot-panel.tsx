"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CopilotMessageList, type CopilotMessage } from "./copilot-message-list";
import { CopilotInput } from "./copilot-input";
import { CopilotSuggestedPrompts } from "./copilot-suggested-prompts";
import { CopilotActionPreview } from "./copilot-action-preview";
import { getSuggestedPrompts } from "@/lib/copilot/suggested-prompts";
import type { CopilotAction } from "@/lib/copilot/actions";
import { parseActionFromResponse } from "@/lib/copilot/parse-action";
import { COPILOT_HISTORY_LIMIT } from "@/lib/validation/copilot";
import { useI18n } from "@/lib/i18n/provider";

// Keep history items comfortably under the server-side per-message cap.
const HISTORY_CONTENT_MAX = 4000;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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
  const { messages: i18n } = useI18n();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [currentValues, setCurrentValues] = useState<Record<string, string>>({});
  const prompts = getSuggestedPrompts(currentRoute);

  // Mirror of `messages` read at send time so the request carries the latest
  // conversation without putting `messages` in sendMessage's dependency list.
  const messagesRef = useRef<CopilotMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    async function fetchCurrentValues() {
      try {
        const res = await fetch("/api/copilot/current-values");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data) {
            setCurrentValues(data);
          }
        }
      } catch {
        // silently ignore – preview will just show "No current value"
      }
    }
    fetchCurrentValues();
    return () => { cancelled = true; };
  }, []);

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
          : i18n.copilot.failedToApply
      );
    }
  }, [i18n.copilot.failedToApply]);

  const handleDismissAction = useCallback((messageIndex: number) => {
    setPendingActions((prev) =>
      prev.filter((pa) => pa.messageIndex !== messageIndex)
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      // Capture prior turns before appending the new one.
      const history = messagesRef.current
        .slice(-COPILOT_HISTORY_LIMIT)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, HISTORY_CONTENT_MAX),
        }))
        .filter((m) => m.content.trim().length > 0);

      const userMsg: CopilotMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, route: currentRoute, history }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : i18n.copilot.couldNotProcess
          );
        }

        const rawContent =
          typeof data?.response === "string"
            ? data.response
            : i18n.copilot.sorryNoProcess;

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
            content: getErrorMessage(error, i18n.copilot.genericError),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [currentRoute, i18n.copilot.genericError, i18n.copilot.couldNotProcess, i18n.copilot.sorryNoProcess]
  );

  return (
    <div
      className="copilot-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-panel-title"
    >
      <div className="copilot-panel-header">
        <div>
          <strong id="copilot-panel-title" style={{ fontSize: 14 }}>{i18n.copilot.title}</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            {i18n.copilot.subtitle}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ghost-btn"
          aria-label={i18n.common.close}
          style={{ fontSize: 18, padding: "2px 8px", lineHeight: 1 }}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <CopilotMessageList messages={messages} />

      {pendingActions.map((pa) => (
        <CopilotActionPreview
          key={pa.messageIndex}
          action={pa.action}
          currentValues={currentValues}
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
          {i18n.copilot.thinking}
        </div>
      )}
    </div>
  );
}

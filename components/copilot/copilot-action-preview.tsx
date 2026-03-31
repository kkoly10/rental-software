"use client";

import { useState } from "react";
import type { CopilotAction } from "@/lib/copilot/actions";

const FIELD_LABELS: Record<string, string> = {
  hero_message: "Hero Message",
  service_area_text: "Service Area Text",
  booking_message: "Booking Message",
  custom_faq: "FAQ",
  about_text: "About Section",
};

function getFieldLabel(action: CopilotAction): string {
  if (action.type === "generate_content") {
    return FIELD_LABELS[action.field] ?? action.field;
  }
  const fieldMap: Record<string, string> = {
    update_hero: "Hero Message",
    update_service_area_text: "Service Area Text",
    update_booking_message: "Booking Message",
    update_faq: "FAQ",
    update_about: "About Section",
  };
  return fieldMap[action.type] ?? action.type;
}

function formatValue(value: string, field: string): string {
  if (field === "custom_faq") {
    try {
      const items = JSON.parse(value);
      if (Array.isArray(items)) {
        return items
          .map(
            (item: { question: string; answer: string }) =>
              `Q: ${item.question}\nA: ${item.answer}`
          )
          .join("\n\n");
      }
    } catch {
      // fall through
    }
  }
  return value;
}

function getFaqCount(value: string): number | null {
  try {
    const items = JSON.parse(value);
    if (Array.isArray(items)) return items.length;
  } catch {
    // not valid JSON
  }
  return null;
}

export function CopilotActionPreview({
  action,
  currentValues,
  onApply,
  onDismiss,
}: {
  action: CopilotAction;
  currentValues?: Record<string, string>;
  onApply: (action: CopilotAction) => Promise<void>;
  onDismiss: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const fieldLabel = getFieldLabel(action);
  const displayValue = formatValue(action.value, action.field);

  const currentRaw = currentValues?.[action.field] ?? "";
  const currentDisplay = currentRaw
    ? formatValue(currentRaw, action.field)
    : "";

  const isFaq = action.field === "custom_faq";
  const currentFaqCount = isFaq && currentRaw ? getFaqCount(currentRaw) : null;
  const newFaqCount = isFaq ? getFaqCount(action.value) : null;

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(action);
      setResult({ ok: true, message: "Changes applied successfully." });
    } catch (error) {
      setResult({
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to apply changes.",
      });
    } finally {
      setApplying(false);
    }
  }

  if (result) {
    return (
      <div
        className={
          result.ok
            ? "copilot-action-preview copilot-action-success"
            : "copilot-action-preview copilot-action-error"
        }
      >
        <div className="copilot-action-field-label">
          {result.ok ? "Applied" : "Error"}
        </div>
        <div style={{ fontSize: 13 }}>{result.message}</div>
      </div>
    );
  }

  return (
    <div className="copilot-action-preview">
      <div className="copilot-action-field-label">
        Proposed change: {fieldLabel}
      </div>
      {action.preview && (
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>
          {action.preview}
        </div>
      )}
      {isFaq && currentFaqCount !== null && newFaqCount !== null && (
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>
          {currentFaqCount} FAQ{currentFaqCount !== 1 ? "s" : ""} → {newFaqCount} FAQ{newFaqCount !== 1 ? "s" : ""}
        </div>
      )}
      <div className="copilot-action-diff">
        <div className="copilot-action-current">
          <div className="copilot-action-label">Current</div>
          {currentDisplay ? (
            <pre>{currentDisplay}</pre>
          ) : (
            <div className="copilot-action-empty">No current value</div>
          )}
        </div>
        <div className="copilot-action-proposed">
          <div className="copilot-action-label">New</div>
          <pre>{displayValue}</pre>
        </div>
      </div>
      <div className="copilot-action-buttons">
        <button
          className="primary-btn copilot-action-apply-btn"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? "Applying..." : "Apply Changes"}
        </button>
        <button
          className="ghost-btn copilot-action-dismiss-btn"
          onClick={onDismiss}
          disabled={applying}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

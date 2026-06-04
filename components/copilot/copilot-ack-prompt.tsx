"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * One-time gate shown before the operator's first Copilot action. They must
 * accept the AI-assistance terms; acceptance is recorded server-side with a
 * timestamp + IP/user-agent. Rendered in place of the action preview until
 * acknowledged.
 */
export function CopilotAckPrompt({
  terms,
  onAgree,
  onCancel,
}: {
  terms: string;
  onAgree: () => Promise<void>;
  onCancel: () => void;
}) {
  const { messages: m } = useI18n();
  const ack = m.copilot.acknowledgment;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgree() {
    setBusy(true);
    setError(null);
    try {
      await onAgree();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.copilot.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="copilot-action-preview">
      <div className="copilot-action-field-label">{ack.title}</div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-soft)",
          whiteSpace: "pre-wrap",
          marginBottom: 8,
        }}
      >
        {terms}
      </div>
      {error && (
        <div style={{ fontSize: 12, color: "var(--danger, #c0392b)", marginBottom: 8 }}>
          {error}
        </div>
      )}
      <div className="copilot-action-buttons">
        <button
          className="primary-btn copilot-action-apply-btn"
          onClick={handleAgree}
          disabled={busy}
        >
          {busy ? ack.agreeing : ack.agree}
        </button>
        <button
          className="ghost-btn copilot-action-dismiss-btn"
          onClick={onCancel}
          disabled={busy}
        >
          {ack.cancel}
        </button>
      </div>
    </div>
  );
}

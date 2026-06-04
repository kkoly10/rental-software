"use client";

import { useState } from "react";
import type {
  CopilotAction,
  CopilotContentAction,
  CopilotPaymentAction,
  CopilotOrderStatusAction,
} from "@/lib/copilot/actions";
import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n/dictionaries";

function humanizeStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  partial: "Partial",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  card_manual: "Card",
  venmo: "Venmo",
  zelle: "Zelle",
  other: "Other",
};

function getFieldLabel(action: CopilotContentAction, m: Messages): string {
  const fieldLabels: Record<string, string> = {
    hero_message: m.copilot.fields.heroMessage,
    service_area_text: m.copilot.fields.serviceAreaText,
    booking_message: m.copilot.fields.bookingMessage,
    custom_faq: m.copilot.fields.faq,
    about_text: m.copilot.fields.aboutSection,
  };
  if (action.type === "generate_content") {
    return fieldLabels[action.field] ?? action.field;
  }
  const fieldMap: Record<string, string> = {
    update_hero: m.copilot.fields.heroMessage,
    update_service_area_text: m.copilot.fields.serviceAreaText,
    update_booking_message: m.copilot.fields.bookingMessage,
    update_faq: m.copilot.fields.faq,
    update_about: m.copilot.fields.aboutSection,
  };
  return fieldMap[action.type] ?? action.type;
}

function formatValue(value: string, field: string, qPrefix: string, aPrefix: string): string {
  if (field === "custom_faq") {
    try {
      const items = JSON.parse(value);
      if (Array.isArray(items)) {
        return items
          .map(
            (item: { question: string; answer: string }) =>
              `${qPrefix} ${item.question}\n${aPrefix} ${item.answer}`
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
  // Dispatch by action kind so each preview owns its own hooks unconditionally.
  if (action.type === "record_payment") {
    return (
      <PaymentActionPreview
        action={action}
        onApply={onApply}
        onDismiss={onDismiss}
      />
    );
  }
  if (action.type === "update_order_status") {
    return (
      <OrderStatusActionPreview
        action={action}
        onApply={onApply}
        onDismiss={onDismiss}
      />
    );
  }
  return (
    <ContentActionPreview
      action={action}
      currentValues={currentValues}
      onApply={onApply}
      onDismiss={onDismiss}
    />
  );
}

function ContentActionPreview({
  action,
  currentValues,
  onApply,
  onDismiss,
}: {
  action: CopilotContentAction;
  currentValues?: Record<string, string>;
  onApply: (action: CopilotAction) => Promise<void>;
  onDismiss: () => void;
}) {
  const { messages: m, t } = useI18n();
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const fieldLabel = getFieldLabel(action, m);
  const displayValue = formatValue(action.value, action.field, m.copilot.faqQuestionPrefix, m.copilot.faqAnswerPrefix);

  const currentRaw = currentValues?.[action.field] ?? "";
  const currentDisplay = currentRaw
    ? formatValue(currentRaw, action.field, m.copilot.faqQuestionPrefix, m.copilot.faqAnswerPrefix)
    : "";

  const isFaq = action.field === "custom_faq";
  const currentFaqCount = isFaq && currentRaw ? getFaqCount(currentRaw) : null;
  const newFaqCount = isFaq ? getFaqCount(action.value) : null;

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(action);
      setResult({ ok: true, message: m.copilot.appliedSuccess });
    } catch (error) {
      setResult({
        ok: false,
        message:
          error instanceof Error ? error.message : m.copilot.failedToApply,
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
          {result.ok ? m.copilot.appliedLabel : m.copilot.errorLabel}
        </div>
        <div style={{ fontSize: 13 }}>{result.message}</div>
      </div>
    );
  }

  return (
    <div className="copilot-action-preview">
      <div className="copilot-action-field-label">
        {t(m.copilot.proposedChange, { field: fieldLabel })}
      </div>
      {action.preview && (
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>
          {action.preview}
        </div>
      )}
      {isFaq && currentFaqCount !== null && newFaqCount !== null && (
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>
          {t(m.copilot.faqCount, {
            currentCount: currentFaqCount,
            currentPlural: currentFaqCount !== 1 ? "s" : "",
            newCount: newFaqCount,
            newPlural: newFaqCount !== 1 ? "s" : "",
          })}
        </div>
      )}
      <div className="copilot-action-diff">
        <div className="copilot-action-current">
          <div className="copilot-action-label">{m.copilot.current}</div>
          {currentDisplay ? (
            <pre>{currentDisplay}</pre>
          ) : (
            <div className="copilot-action-empty">{m.copilot.noCurrentValue}</div>
          )}
        </div>
        <div className="copilot-action-proposed">
          <div className="copilot-action-label">{m.copilot.proposed}</div>
          <pre>{displayValue}</pre>
        </div>
      </div>
      <div className="copilot-action-buttons">
        <button
          className="primary-btn copilot-action-apply-btn"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? m.copilot.applying : m.copilot.applyChanges}
        </button>
        <button
          className="ghost-btn copilot-action-dismiss-btn"
          onClick={onDismiss}
          disabled={applying}
        >
          {m.copilot.dismiss}
        </button>
      </div>
    </div>
  );
}

function PaymentActionPreview({
  action,
  onApply,
  onDismiss,
}: {
  action: CopilotPaymentAction;
  onApply: (action: CopilotAction) => Promise<void>;
  onDismiss: () => void;
}) {
  const { messages: m, locale } = useI18n();
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const { params } = action;
  const rp = m.copilot.recordPayment;
  const amountDisplay = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(params.amount);

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(action);
      setResult({ ok: true, message: m.copilot.appliedSuccess });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : m.copilot.failedToApply,
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
          {result.ok ? m.copilot.appliedLabel : m.copilot.errorLabel}
        </div>
        <div style={{ fontSize: 13 }}>{result.message}</div>
      </div>
    );
  }

  return (
    <div className="copilot-action-preview">
      <div className="copilot-action-field-label">{rp.title}</div>
      {action.preview && (
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>
          {action.preview}
        </div>
      )}
      <div style={{ fontSize: 13, display: "grid", gap: 4, marginBottom: 8 }}>
        <div>
          <strong>{rp.order}:</strong>{" "}
          <a
            href={`/dashboard/orders/${params.orderId}`}
            style={{ color: "var(--primary)" }}
          >
            {rp.viewOrder}
          </a>
        </div>
        <div>
          <strong>{rp.amount}:</strong> {amountDisplay}
        </div>
        <div>
          <strong>{rp.method}:</strong>{" "}
          {PAYMENT_METHOD_LABELS[params.paymentMethod] ?? params.paymentMethod}
        </div>
        <div>
          <strong>{rp.type}:</strong>{" "}
          {PAYMENT_TYPE_LABELS[params.paymentType] ?? params.paymentType}
        </div>
        {params.referenceNote && (
          <div>
            <strong>{rp.note}:</strong> {params.referenceNote}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 8 }}>
        {rp.caution}
      </div>
      <div className="copilot-action-buttons">
        <button
          className="primary-btn copilot-action-apply-btn"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? rp.recording : rp.confirm}
        </button>
        <button
          className="ghost-btn copilot-action-dismiss-btn"
          onClick={onDismiss}
          disabled={applying}
        >
          {m.copilot.dismiss}
        </button>
      </div>
    </div>
  );
}

function OrderStatusActionPreview({
  action,
  onApply,
  onDismiss,
}: {
  action: CopilotOrderStatusAction;
  onApply: (action: CopilotAction) => Promise<void>;
  onDismiss: () => void;
}) {
  const { messages: m } = useI18n();
  const os = m.copilot.orderStatus;
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const { params } = action;

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(action);
      setResult({ ok: true, message: m.copilot.appliedSuccess });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : m.copilot.failedToApply,
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
          {result.ok ? m.copilot.appliedLabel : m.copilot.errorLabel}
        </div>
        <div style={{ fontSize: 13 }}>{result.message}</div>
      </div>
    );
  }

  return (
    <div className="copilot-action-preview">
      <div className="copilot-action-field-label">{os.title}</div>
      {action.preview && (
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6 }}>
          {action.preview}
        </div>
      )}
      <div style={{ fontSize: 13, display: "grid", gap: 4, marginBottom: 8 }}>
        <div>
          <strong>{m.copilot.recordPayment.order}:</strong>{" "}
          <a
            href={`/dashboard/orders/${params.orderId}`}
            style={{ color: "var(--primary)" }}
          >
            {m.copilot.recordPayment.viewOrder}
          </a>
        </div>
        <div>
          <strong>{os.newStatus}:</strong> {humanizeStatus(params.newStatus)}
        </div>
      </div>
      <div className="copilot-action-buttons">
        <button
          className="primary-btn copilot-action-apply-btn"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? os.updating : os.confirm}
        </button>
        <button
          className="ghost-btn copilot-action-dismiss-btn"
          onClick={onDismiss}
          disabled={applying}
        >
          {m.copilot.dismiss}
        </button>
      </div>
    </div>
  );
}

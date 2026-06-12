"use client";

import { useActionState } from "react";
import { recordPayment } from "@/lib/payments/actions";
import { useI18n } from "@/lib/i18n/provider";
import { toLocalISODate } from "@/lib/i18n/format-helpers";

const initialState = { ok: false, message: "" };

export function RecordPaymentForm({
  orderId,
  balanceDue,
  depositDue,
}: {
  orderId: string;
  /** Display-ready outstanding balance (e.g. "$170.00"). Shown above the
      amount input so operators don't have to flip between tabs. */
  balanceDue?: string;
  /** Display-ready deposit required (e.g. "$75.00"). */
  depositDue?: string;
}) {
  const [state, formAction, pending] = useActionState(recordPayment, initialState);
  const { messages } = useI18n();
  const m = messages.forms.recordPayment;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="order_id" value={orderId} />

      {(balanceDue || depositDue) && (
        <div
          className="order-card"
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            fontSize: 13,
          }}
        >
          {balanceDue && (
            <div>
              <span className="muted">{m.balanceLabel}: </span>
              <strong>{balanceDue}</strong>
            </div>
          )}
          {depositDue && (
            <div>
              <span className="muted">{m.depositRequiredLabel}: </span>
              <strong>{depositDue}</strong>
            </div>
          )}
        </div>
      )}

      {/* form-grid stacks to a single column in narrow containers (the
          payments-page aside) instead of cramming three ~100px columns
          with letter-by-letter wrapping. */}
      <div className="form-grid">
        <label className="form-field">
          <strong>{m.amountLabel}</strong>
          <input name="amount" type="number" step="0.01" min="0.01" required style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="form-field">
          <strong>{m.paymentTypeLabel}</strong>
          <select
            name="payment_type"
            defaultValue="deposit"
            title={m.paymentTypeHint}
            style={{ marginTop: 8, width: "100%" }}
          >
            <option value="deposit">{m.paymentTypes.deposit}</option>
            <option value="balance">{m.paymentTypes.balance}</option>
            <option value="partial">{m.paymentTypes.partial}</option>
            <option value="refund">{m.paymentTypes.refund}</option>
          </select>
        </label>

        <label className="form-field">
          <strong>{m.methodLabel}</strong>
          <select name="payment_method" defaultValue="cash" style={{ marginTop: 8, width: "100%" }}>
            <option value="cash">{m.methods.cash}</option>
            <option value="check">{m.methods.check}</option>
            <option value="card_manual">{m.methods.cardManual}</option>
            <option value="venmo">{m.methods.venmo}</option>
            <option value="zelle">{m.methods.zelle}</option>
            <option value="other">{m.methods.other}</option>
          </select>
        </label>
      </div>

      {/* Hint lives once below the grid, full width, instead of blowing
          up one column's height. */}
      <p className="muted" style={{ fontSize: 12.5, margin: "2px 0 0", lineHeight: 1.55 }}>
        {m.paymentTypeHint}
      </p>

      <div className="form-grid">
        <label className="form-field">
          <strong>{m.datePaidLabel}</strong>
          <input name="paid_at" type="date" defaultValue={toLocalISODate()} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="form-field form-field--wide">
          <strong>{m.referenceNoteLabel}</strong>
          <input name="reference_note" type="text" placeholder={m.referenceNotePlaceholder} style={{ marginTop: 8, width: "100%" }} />
        </label>
      </div>

      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          aria-live={state.ok ? "polite" : "assertive"}
          className={state.ok ? "badge success" : "badge warning"}
          style={{ padding: "10px 14px" }}
        >
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}

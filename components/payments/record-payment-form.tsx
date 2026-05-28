"use client";

import { useActionState } from "react";
import { recordPayment } from "@/lib/payments/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function RecordPaymentForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(recordPayment, initialState);
  const { messages } = useI18n();
  const m = messages.forms.recordPayment;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="order_id" value={orderId} />

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.amountLabel}</strong>
          <input name="amount" type="number" step="0.01" min="0.01" required style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>{m.paymentTypeLabel}</strong>
          <select name="payment_type" defaultValue="deposit" style={{ marginTop: 8, width: "100%" }}>
            <option value="deposit">{m.paymentTypes.deposit}</option>
            <option value="balance">{m.paymentTypes.balance}</option>
            <option value="partial">{m.paymentTypes.partial}</option>
            <option value="refund">{m.paymentTypes.refund}</option>
          </select>
        </label>

        <label className="order-card">
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

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.datePaidLabel}</strong>
          <input name="paid_at" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card" style={{ gridColumn: "span 2" }}>
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

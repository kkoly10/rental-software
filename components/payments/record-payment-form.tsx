"use client";

import { useActionState } from "react";
import { recordPayment } from "@/lib/payments/actions";

const initialState = { ok: false, message: "" };

export function RecordPaymentForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(recordPayment, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="order_id" value={orderId} />

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Amount ($)</strong>
          <input name="amount" type="number" step="0.01" min="0.01" required style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>Payment type</strong>
          <select name="payment_type" defaultValue="deposit" style={{ marginTop: 8, width: "100%" }}>
            <option value="deposit">Deposit</option>
            <option value="balance">Balance</option>
            <option value="partial">Partial</option>
            <option value="refund">Refund</option>
          </select>
        </label>

        <label className="order-card">
          <strong>Method</strong>
          <select name="payment_method" defaultValue="cash" style={{ marginTop: 8, width: "100%" }}>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="card_manual">Card (manual)</option>
            <option value="venmo">Venmo</option>
            <option value="zelle">Zelle</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Date paid</strong>
          <input name="paid_at" type="date" defaultValue={new Date().toISOString().split("T")[0]} style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card" style={{ gridColumn: "span 2" }}>
          <strong>Reference / note</strong>
          <input name="reference_note" type="text" placeholder="Check #, Venmo ID, etc." style={{ marginTop: 8, width: "100%" }} />
        </label>
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Recording..." : "Record Payment"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { issueStripeRefund } from "@/lib/payments/refund-actions";

/**
 * Operator-initiated Stripe refund.
 *
 * Surfaces a "Refund deposit" affordance on orders where a Stripe
 * deposit has been captured. Hidden when the order is in a state
 * where issuing a refund makes no sense (refunded, inquiry, no
 * deposit captured) — the action will reject server-side too.
 *
 * Two-step UI: button reveals an inline form with amount + reason
 * before issuing. The reason is required because the row gets
 * exported to QuickBooks/Xero and the operator (or auditor)
 * shouldn't have to guess later.
 */
export function RefundDepositButton({
  orderId,
  depositPaidAmount,
  status,
}: {
  orderId: string;
  /** Total captured-deposit dollar amount, used to suggest the
   *  default refund amount and cap the input. 0 hides the button. */
  depositPaidAmount: number;
  /** Title-cased order status string from the page. */
  status: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(depositPaidAmount.toFixed(2));
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (depositPaidAmount <= 0) return null;

  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (normalized === "refunded" || normalized === "inquiry") return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("amount", amount);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await issueStripeRefund({ ok: false, message: "" }, fd);
      setResult(res);
      if (res.ok) {
        setIsOpen(false);
        setReason("");
      }
    });
  }

  if (result?.ok) {
    return (
      <span className="badge success" style={{ fontSize: 12 }}>
        {result.message}
      </span>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="ghost-btn"
        onClick={() => setIsOpen(true)}
        style={{ fontSize: 13 }}
      >
        Refund deposit
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 8, alignItems: "flex-start", minWidth: 240 }}
    >
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        <span className="muted">Amount ($)</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={depositPaidAmount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          style={{ padding: "6px 8px", fontSize: 13 }}
        />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        <span className="muted">Reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={2}
          placeholder="Customer requested cancellation; weather; etc."
          style={{ padding: "6px 8px", fontSize: 13, resize: "vertical" }}
        />
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="submit"
          className="primary-btn"
          disabled={isPending}
          style={{ fontSize: 13 }}
        >
          {isPending ? "Refunding…" : "Issue refund"}
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setIsOpen(false)}
          disabled={isPending}
          style={{ fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }} role="alert">
          {result.message}
        </span>
      )}
    </form>
  );
}

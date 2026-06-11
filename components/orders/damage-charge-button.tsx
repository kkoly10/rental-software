"use client";

import { useState, useTransition } from "react";
import { chargeCustomerCardForDamage } from "@/lib/payments/damage-charge-actions";
import type { SavedPaymentMethodSummary } from "@/lib/data/customer-payment-methods";

/**
 * PR-3c — operator-initiated post-event damage charge.
 *
 * Sister to <RefundDepositButton>: same two-step open-form pattern.
 * Hidden when the customer has no saved cards on file (the action
 * itself enforces this server-side too, with a friendly message).
 *
 * Status surface: success → green badge with the charged amount;
 * SCA-required → warning badge ("send an invoice link instead"); any
 * other failure → red badge with the Stripe error.
 */
export function DamageChargeButton({
  orderId,
  paymentMethods,
}: {
  orderId: string;
  paymentMethods: SavedPaymentMethodSummary[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods[0]?.id ?? ""
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (paymentMethods.length === 0) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("payment_method_id", paymentMethodId);
    fd.set("amount", amount);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await chargeCustomerCardForDamage(
        { ok: false, message: "" },
        fd
      );
      setResult(res);
      if (res.ok) {
        setIsOpen(false);
        setAmount("");
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
        Charge for damage
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 8, alignItems: "flex-start", minWidth: 260 }}
    >
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        <span className="muted">Saved card</span>
        <select
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          required
          style={{ padding: "6px 8px", fontSize: 13 }}
        >
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {(pm.cardBrand ?? "Card").toUpperCase()} •••• {pm.cardLast4 ?? "????"}
              {pm.cardExpMonth && pm.cardExpYear
                ? ` (exp ${String(pm.cardExpMonth).padStart(2, "0")}/${String(pm.cardExpYear).slice(-2)})`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        <span className="muted">Amount ($)</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
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
          placeholder="Damaged chair leg; stained linen; missing extension cord"
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
          {isPending ? "Charging…" : "Charge card"}
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

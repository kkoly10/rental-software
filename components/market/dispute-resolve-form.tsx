"use client";

import { useActionState } from "react";
import { resolveDispute, type DisputeActionState } from "@/lib/market/dispute-actions";

const initial: DisputeActionState = { ok: false, message: "" };

export function DisputeResolveForm({
  disputeId,
  depositCents,
  depositStatus,
}: {
  disputeId: string;
  depositCents: number;
  depositStatus: string;
}) {
  const [state, action, pending] = useActionState(resolveDispute, initial);

  if (state.ok) {
    return <p style={{ fontSize: 13, color: "#1e7f4f" }}>✓ {state.message}</p>;
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <input type="hidden" name="dispute_id" value={disputeId} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="outcome" required className="sel" style={{ fontSize: 13, padding: 8, borderRadius: 8 }}>
          <option value="resolved_no_fault">No fault — release deposit</option>
          <option value="resolved_seller_liable">Seller liable — release deposit</option>
          <option value="resolved_renter_liable">Renter liable — capture deposit</option>
          <option value="resolved_split">Split — partial capture</option>
        </select>
        <input
          type="number"
          name="capture_cents"
          min={0}
          max={depositCents}
          placeholder={`capture from deposit (cents, max ${depositCents})`}
          style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e0d8", width: 230 }}
          disabled={depositStatus !== "held"}
        />
        <input
          type="number"
          name="refund_cents"
          min={0}
          placeholder="refund renter (cents)"
          style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e0d8", width: 180 }}
        />
      </div>
      <textarea
        name="note"
        required
        minLength={5}
        maxLength={2000}
        rows={2}
        placeholder="Resolution note (visible in the booking event log)"
        style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e0d8" }}
      />
      <button type="submit" className="primary-btn" disabled={pending} style={{ alignSelf: "flex-start", fontSize: 13 }}>
        {pending ? "Resolving…" : "Resolve dispute"}
      </button>
      {state.message ? <span style={{ fontSize: 12, color: "#b91c1c" }}>{state.message}</span> : null}
    </form>
  );
}

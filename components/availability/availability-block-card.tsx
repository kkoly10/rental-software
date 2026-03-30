"use client";

import { useState } from "react";
import type { AvailabilityBlock } from "@/lib/availability/data";
import { removeAvailabilityBlock } from "@/lib/availability/actions";

const blockTypeLabels: Record<string, { label: string; tone: string }> = {
  order_hold: { label: "Order", tone: "default" },
  manual_hold: { label: "Manual", tone: "warning" },
  maintenance: { label: "Maintenance", tone: "danger" },
  private_event: { label: "Private", tone: "default" },
};

function formatBlockDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function AvailabilityBlockCard({ block }: { block: AvailabilityBlock }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const info = blockTypeLabels[block.blockType] ?? blockTypeLabels.manual_hold;
  const isOrderBlock = block.blockType === "order_hold";

  async function handleRemove() {
    if (!confirm("Remove this availability block?")) return;
    setPending(true);
    const result = await removeAvailabilityBlock(block.id);
    setMessage(result.message);
    setPending(false);
  }

  return (
    <div className="order-card">
      <div className="order-row">
        <div>
          <strong>{block.productName}</strong>
          <div className="muted">
            {formatBlockDate(block.startsAt)} — {formatBlockDate(block.endsAt)}
          </div>
          {block.reason && (
            <div className="muted" style={{ fontSize: 12 }}>{block.reason}</div>
          )}
          {block.orderNumber && (
            <div className="muted" style={{ fontSize: 12 }}>
              Order #{block.orderNumber}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${info.tone}`}>{info.label}</span>
          {!isOrderBlock && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="ghost-btn"
              style={{ fontSize: 12, padding: "4px 8px" }}
            >
              {pending ? "..." : "Remove"}
            </button>
          )}
        </div>
      </div>
      {message && <div className="badge" style={{ marginTop: 4 }}>{message}</div>}
    </div>
  );
}

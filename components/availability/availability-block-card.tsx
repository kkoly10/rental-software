"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvailabilityBlock } from "@/lib/availability/data";
import { removeAvailabilityBlock } from "@/lib/availability/actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const BLOCK_TYPE_KEY_MAP: Record<string, { key: "order" | "manual" | "maintenance" | "private"; tone: string }> = {
  order_hold: { key: "order", tone: "default" },
  manual_hold: { key: "manual", tone: "warning" },
  maintenance: { key: "maintenance", tone: "danger" },
  private_event: { key: "private", tone: "default" },
};

export function AvailabilityBlockCard({ block }: { block: AvailabilityBlock }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const { messages: m, locale } = useI18n();

  function formatBlockDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  const info = BLOCK_TYPE_KEY_MAP[block.blockType] ?? BLOCK_TYPE_KEY_MAP.manual_hold;
  const label = m.availabilityBlock.kinds[info.key];
  const isOrderBlock = block.blockType === "order_hold";

  async function handleRemove() {
    if (!confirm(m.availabilityBlock.removeConfirm)) return;
    setPending(true);
    const result = await removeAvailabilityBlock(block.id);
    setMessage(result.message);
    setPending(false);
    // Refresh so the removed block disappears from the list immediately.
    if (result.ok) router.refresh();
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
              {formatMessage(m.availabilityBlock.orderPrefix, { number: block.orderNumber })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${info.tone}`}>{label}</span>
          {!isOrderBlock && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="ghost-btn"
              style={{ fontSize: 12, padding: "4px 8px" }}
            >
              {pending ? "..." : m.common.remove}
            </button>
          )}
        </div>
      </div>
      {message && <div className="badge" style={{ marginTop: 4 }}>{message}</div>}
    </div>
  );
}

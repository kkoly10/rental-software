"use client";

import { useActionState } from "react";
import { sendMarketMessage, type MessageActionState } from "@/lib/market/message-actions";

const initial: MessageActionState = { ok: false, message: "" };

export function MessageForm({
  listingId,
  conversationId,
  placeholder = "Ask about availability, sizing, delivery…",
}: {
  listingId?: string;
  conversationId?: string;
  placeholder?: string;
}) {
  const [state, action, pending] = useActionState(sendMarketMessage, initial);

  return (
    <form action={action} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      {listingId ? <input type="hidden" name="listing_id" value={listingId} /> : null}
      {conversationId ? <input type="hidden" name="conversation_id" value={conversationId} /> : null}
      <input
        type="text"
        name="body"
        required
        maxLength={2000}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 180, padding: "10px 14px", border: "1px solid var(--mk-line, #f0e4d8)", borderRadius: 999, font: "inherit" }}
      />
      <button type="submit" className="mk-btn" disabled={pending} style={{ padding: "10px 18px" }}>
        {pending ? "…" : "Send"}
      </button>
      {state.message ? (
        <span style={{ width: "100%", fontSize: 12, color: state.ok ? "#1e7f4f" : "#b91c1c" }}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { sendReply, type ReplyActionState } from "@/lib/messages/actions";

const initialState: ReplyActionState = { ok: false, message: "" };

export function ReplyForm({
  customerEmail,
  customerId,
  orderId,
  orderNumber,
}: {
  customerEmail: string;
  customerId: string | null;
  orderId: string | null;
  orderNumber: string | null;
}) {
  const [state, action, pending] = useActionState(sendReply, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="customer_email" value={customerEmail} />
      <input type="hidden" name="customer_id" value={customerId ?? ""} />
      <input type="hidden" name="order_id" value={orderId ?? ""} />
      <input type="hidden" name="order_number" value={orderNumber ?? ""} />

      <textarea
        name="body"
        placeholder="Type your reply..."
        required
        rows={4}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border, #dbe6f4)",
          fontFamily: "inherit",
          fontSize: 14,
          resize: "vertical",
          minHeight: 100,
        }}
      />

      {state.message && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 14,
            background: state.ok ? "#eaf9f4" : "#fff0f0",
            color: state.ok ? "#188862" : "#c41e1e",
          }}
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        className="btn primary"
        disabled={pending || !customerEmail}
        style={{ marginTop: 12 }}
      >
        {pending ? "Sending..." : "Send Reply"}
      </button>

      {!customerEmail && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          No customer email available for this conversation.
        </div>
      )}
    </form>
  );
}

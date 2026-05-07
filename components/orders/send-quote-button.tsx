"use client";

import { useState, useTransition } from "react";
import { sendQuote } from "@/lib/quotes/actions";

export function SendQuoteButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await sendQuote(orderId);
      setResult(res);
    });
  }

  if (result?.ok) {
    return (
      <span className="badge success" style={{ fontSize: 12 }}>
        {result.message}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <button
        type="button"
        className="primary-btn"
        onClick={handleClick}
        disabled={isPending}
        style={{ fontSize: 13 }}
      >
        {isPending ? "Sending…" : "Send Quote to Customer"}
      </button>
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }}>{result.message}</span>
      )}
    </div>
  );
}

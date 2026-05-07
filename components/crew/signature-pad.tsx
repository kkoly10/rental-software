"use client";

import { useActionState } from "react";
import { saveSignature, type StopActionState } from "@/lib/crew/actions";

const initial: StopActionState = { ok: false, message: "" };

export function SignaturePad({ stopId }: { stopId: string }) {
  const [state, action, pending] = useActionState(saveSignature, initial);

  if (state.ok) {
    return (
      <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--surface-2, #f8f8f8)", borderRadius: 8, border: "1px solid var(--border)" }}>
        <span className="badge success" style={{ fontSize: 11 }}>Signed</span>
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="stop_id" value={stopId} />
      <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 6, fontWeight: 500 }}>
        Customer signature
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          name="signer_name"
          type="text"
          placeholder="Customer full name"
          required
          style={{
            flex: 1,
            fontSize: 14,
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontFamily: "cursive",
            background: "white",
          }}
        />
        <button
          type="submit"
          className="primary-btn"
          disabled={pending}
          style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}
        >
          {pending ? "Saving…" : "Sign"}
        </button>
      </div>
      {state.message && !state.ok && (
        <div className="badge warning" style={{ marginTop: 6, fontSize: 12 }}>{state.message}</div>
      )}
    </form>
  );
}

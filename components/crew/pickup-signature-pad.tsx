"use client";

import { useActionState } from "react";
import { savePickupSignature, type StopActionState } from "@/lib/crew/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: StopActionState = { ok: false, message: "" };

/**
 * Sprint 5.5 — pickup-side signature pad mirroring SignaturePad.
 *
 * Surfaces a name-field signature capture at the pickup completion
 * moment. Customer types their name; we store
 * `{name} — {ISO timestamp}` as the signature record. Same shape as
 * the delivery-side equivalent so the crew workspace and the order
 * detail page render the two records identically.
 *
 * The form re-uses the same i18n keys as SignaturePad — the pickup-
 * vs-delivery distinction comes from which row it lands on
 * (route_stops.pickup_signature_name vs signature_name), not from the
 * copy. Operators who need to distinguish them in customer comms can
 * frame it in the broader UI surrounding the form.
 */
export function PickupSignaturePad({ stopId }: { stopId: string }) {
  const { messages } = useI18n();
  const t = messages.forms.crew.signature;
  const [state, action, pending] = useActionState(savePickupSignature, initial);

  if (state.ok) {
    return (
      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          background: "var(--surface-2, #f8f8f8)",
          borderRadius: 8,
          border: "1px solid var(--border)",
        }}
      >
        <span className="badge success" style={{ fontSize: 11 }}>{t.signed}</span>
        <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 4 }}>
          {state.message}
        </div>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="stop_id" value={stopId} />
      <div
        style={{
          fontSize: 12,
          color: "var(--text-soft)",
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {t.title}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          name="signer_name"
          type="text"
          placeholder={t.customerNamePlaceholder}
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
          {pending ? t.saving : t.sign}
        </button>
      </div>
      {state.message && !state.ok && (
        <div className="badge warning" style={{ marginTop: 6, fontSize: 12 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import {
  confirmPhoneOtp,
  sendPhoneOtp,
  uploadIdentity,
  type VerifyState,
} from "@/lib/market/verification-actions";

const initial: VerifyState = { ok: false, message: "" };
const input: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid var(--mk-line, #f0e4d8)",
  borderRadius: 10,
  font: "inherit",
};

export function PhoneVerifyForm({ verified }: { verified: boolean }) {
  const [sendState, sendAction, sending] = useActionState(sendPhoneOtp, initial);
  const [confirmState, confirmAction, confirming] = useActionState(confirmPhoneOtp, initial);

  if (verified || confirmState.ok) {
    return <p className="mk-msg ok">✓ Phone verified.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <form action={sendAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="tel"
          name="phone"
          required
          placeholder="(202) 555-0142"
          style={{ ...input, flex: 1, minWidth: 160 }}
          autoComplete="tel"
        />
        <button type="submit" className="mk-btn ghost" disabled={sending}>
          {sending ? "Sending…" : "Text me a code"}
        </button>
        {sendState.message ? (
          <span className={`mk-msg ${sendState.ok ? "ok" : "err"}`} style={{ width: "100%" }}>
            {sendState.message}
          </span>
        ) : null}
        <span className="mk-card-m" style={{ width: "100%", fontSize: 11, lineHeight: 1.5 }}>
          By providing your number, you agree to receive texts from Korent for
          verification codes and rental notifications (booking updates, pickup
          and return reminders). Message and data rates may apply. Reply STOP
          to opt out, HELP for help.
        </span>
      </form>
      <form action={confirmAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="6-digit code"
          style={{ ...input, width: 140 }}
        />
        <button type="submit" className="mk-btn" disabled={confirming}>
          {confirming ? "Checking…" : "Verify"}
        </button>
        {confirmState.message ? (
          <span className="mk-msg err" style={{ width: "100%" }}>
            {confirmState.message}
          </span>
        ) : null}
      </form>
    </div>
  );
}

export function IdentityUploadForm({ onFile }: { onFile: boolean }) {
  const [state, action, pending] = useActionState(uploadIdentity, initial);

  if (onFile || state.ok) {
    return (
      <p className="mk-msg ok">
        ✓ Identity on file — stored privately, reviewed only if a dispute arises.
      </p>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 700 }}>
        Government ID (photo of the front)
        <input type="file" name="id_photo" required accept="image/jpeg,image/png,image/webp" style={{ display: "block", marginTop: 4, fontSize: 12 }} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>
        Live selfie (hold your ID next to your face)
        <input type="file" name="selfie" required accept="image/jpeg,image/png,image/webp" capture="user" style={{ display: "block", marginTop: 4, fontSize: 12 }} />
      </label>
      <button type="submit" className="mk-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Uploading…" : "Save identity"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}

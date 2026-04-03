"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/lib/account/delete-account";

const initialState: DeleteAccountState = {
  ok: false,
  message: "",
};

export function DeleteAccountCard() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  if (!showConfirm) {
    return (
      <section className="panel" style={{ borderLeft: "4px solid var(--danger, #dc2626)" }}>
        <div className="section-header">
          <div>
            <div className="kicker" style={{ color: "var(--danger, #dc2626)" }}>Danger zone</div>
            <h2 style={{ margin: "6px 0 0" }}>Delete account</h2>
          </div>
        </div>

        <p className="muted" style={{ margin: "8px 0 16px", lineHeight: 1.6 }}>
          Permanently delete your organization, all data, and cancel your subscription.
          This action cannot be undone after 30 days.
        </p>

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          style={{
            background: "var(--danger, #dc2626)",
            color: "white",
            border: "none",
            padding: "8px 18px",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Delete my account...
        </button>
      </section>
    );
  }

  return (
    <section className="panel" style={{ borderLeft: "4px solid var(--danger, #dc2626)" }}>
      <div className="section-header">
        <div>
          <div className="kicker" style={{ color: "var(--danger, #dc2626)" }}>Danger zone</div>
          <h2 style={{ margin: "6px 0 0" }}>Confirm account deletion</h2>
        </div>
      </div>

      <div style={{ margin: "8px 0 16px", lineHeight: 1.6 }}>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          This will permanently delete your organization and all associated data including
          orders, customers, products, and team members. Any active Stripe subscription
          will be cancelled immediately.
        </p>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
          Type <code style={{ background: "var(--bg-muted, #f3f4f6)", padding: "2px 6px", borderRadius: 4 }}>DELETE</code> to confirm:
        </p>
      </div>

      <form action={formAction}>
        <input
          name="confirmation"
          type="text"
          placeholder="Type DELETE to confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          style={{ width: "100%", maxWidth: 300, marginBottom: 12 }}
        />

        {state.message && !state.ok ? (
          <div className="badge warning" role="alert" style={{ padding: "8px 12px", marginBottom: 12 }}>
            {state.message}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="submit"
            disabled={pending || confirmation !== "DELETE"}
            style={{
              background: confirmation === "DELETE" ? "var(--danger, #dc2626)" : "var(--bg-muted, #ccc)",
              color: "white",
              border: "none",
              padding: "8px 18px",
              borderRadius: 6,
              cursor: confirmation === "DELETE" ? "pointer" : "not-allowed",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {pending ? "Deleting..." : "Permanently delete account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
              setConfirmation("");
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              padding: "8px 18px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { PendingInvite } from "@/lib/team/data";
import { cancelInvite } from "@/lib/team/actions";

export function PendingInviteCard({
  invite,
  canManage,
}: {
  invite: PendingInvite;
  canManage: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    setPending(true);
    await cancelInvite(invite.id);
    setPending(false);
  }

  return (
    <div className="order-card">
      <div className="order-row">
        <div>
          <strong>{invite.email}</strong>
          <div className="muted">
            Invited as {invite.role} &middot;{" "}
            {new Date(invite.createdAt).toLocaleDateString()}
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="ghost-btn"
            style={{ fontSize: 13, padding: "6px 10px" }}
          >
            {pending ? "..." : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}

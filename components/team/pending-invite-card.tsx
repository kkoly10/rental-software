"use client";

import { useState } from "react";
import type { PendingInvite } from "@/lib/team/data";
import { cancelInvite } from "@/lib/team/actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

export function PendingInviteCard({
  invite,
  canManage,
}: {
  invite: PendingInvite;
  canManage: boolean;
}) {
  const [pending, setPending] = useState(false);
  const { messages: m, locale } = useI18n();

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
            {formatMessage(m.pendingInvite.invitedAs, { role: invite.role })} &middot;{" "}
            {new Date(invite.createdAt).toLocaleDateString(locale)}
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
            {pending ? "..." : m.common.cancel}
          </button>
        )}
      </div>
    </div>
  );
}

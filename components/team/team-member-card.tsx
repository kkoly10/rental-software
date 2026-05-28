"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamMember } from "@/lib/team/data";
import { removeTeamMember, updateMemberRole } from "@/lib/team/actions";
import { useI18n } from "@/lib/i18n/provider";

const roleTones: Record<string, string> = {
  owner: "default",
  admin: "success",
  dispatcher: "warning",
  crew: "default",
  viewer: "default",
};

export function TeamMemberCard({
  member,
  canManage,
}: {
  member: TeamMember;
  canManage: boolean;
}) {
  const { messages: m, t } = useI18n();
  const roleLabels: Record<string, string> = {
    owner: m.dashboard.team.roles.owner,
    admin: m.dashboard.team.roles.admin,
    dispatcher: m.dashboard.team.roles.dispatcher,
    crew: m.dashboard.team.roles.crew,
    viewer: m.dashboard.team.roles.viewer,
  };
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const isOwner = member.role === "owner";
  const showActions = canManage && !member.isCurrentUser && !isOwner;

  async function handleRoleChange(newRole: string) {
    setPending(true);
    setMessage("");
    const result = await updateMemberRole(member.id, newRole);
    setMessage(result.message);
    setPending(false);
    // Refresh so the server-rendered role (the controlled <select> value)
    // reflects the change instead of snapping back to the stale prop.
    if (result.ok) router.refresh();
  }

  async function handleRemove() {
    if (!confirm(t(m.teamMember.confirmRemove, { name: member.name }))) return;
    setPending(true);
    setMessage("");
    const result = await removeTeamMember(member.id);
    setMessage(result.message);
    setPending(false);
    if (result.ok) router.refresh();
  }

  return (
    <div className="order-card">
      <div className="order-row">
        <div>
          <strong>
            {member.name}
            {member.isCurrentUser && (
              <span className="muted" style={{ fontWeight: 400 }}> {m.teamMember.you}</span>
            )}
          </strong>
          <div className="muted">{member.email}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showActions ? (
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={pending}
              aria-label={`Role for ${member.name}`}
              style={{ minHeight: 36, fontSize: 13, borderRadius: 8 }}
            >
              <option value="admin">{m.dashboard.team.roles.admin}</option>
              <option value="dispatcher">{m.dashboard.team.roles.dispatcher}</option>
              <option value="crew">{m.dashboard.team.roles.crew}</option>
              <option value="viewer">{m.dashboard.team.roles.viewer}</option>
            </select>
          ) : (
            <span className={`badge ${roleTones[member.role] ?? "default"}`}>
              {roleLabels[member.role] ?? member.role}
            </span>
          )}

          {showActions && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="ghost-btn"
              style={{ color: "var(--danger)", fontSize: 13, padding: "6px 10px" }}
            >
              {m.teamMember.remove}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="badge" style={{ marginTop: 6 }}>{message}</div>
      )}
    </div>
  );
}

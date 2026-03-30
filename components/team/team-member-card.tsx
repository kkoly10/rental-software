"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/team/data";
import { removeTeamMember, updateMemberRole } from "@/lib/team/actions";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  dispatcher: "Dispatcher",
  crew: "Crew",
  viewer: "Viewer",
};

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
  }

  async function handleRemove() {
    if (!confirm(`Remove ${member.name} from the team?`)) return;
    setPending(true);
    setMessage("");
    const result = await removeTeamMember(member.id);
    setMessage(result.message);
    setPending(false);
  }

  return (
    <div className="order-card">
      <div className="order-row">
        <div>
          <strong>
            {member.name}
            {member.isCurrentUser && (
              <span className="muted" style={{ fontWeight: 400 }}> (you)</span>
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
              style={{ minHeight: 36, fontSize: 13, borderRadius: 8 }}
            >
              <option value="admin">Admin</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="crew">Crew</option>
              <option value="viewer">Viewer</option>
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
              Remove
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

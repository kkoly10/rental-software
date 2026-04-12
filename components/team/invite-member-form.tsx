"use client";

import { useActionState } from "react";
import { inviteTeamMember } from "@/lib/team/actions";

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(inviteTeamMember, {
    ok: true,
    message: "",
  });

  return (
    <form action={formAction}>
      <div className="team-invite-grid">
        <label className="field-stack">
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Email address</span>
          <input
            name="email"
            type="email"
            placeholder="teammate@example.com"
            required
          />
        </label>

        <label className="field-stack">
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Role</span>
          <select name="role" defaultValue="viewer">
            <option value="admin">Admin</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="crew">Crew</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>

        <button type="submit" className="primary-btn team-invite-submit" disabled={pending}>
          {pending ? "Sending..." : "Send Invite"}
        </button>
      </div>

      {state.message && (
        <div
          className={`badge ${state.ok ? "success" : "warning"}`}
          style={{ marginTop: 10 }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}

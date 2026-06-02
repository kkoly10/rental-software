"use client";

import { useActionState } from "react";
import { inviteTeamMember } from "@/lib/team/actions";
import { useI18n } from "@/lib/i18n/provider";

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(inviteTeamMember, {
    ok: true,
    message: "",
  });
  const { messages } = useI18n();
  const m = messages.forms.inviteMember;

  return (
    <form action={formAction}>
      <div className="team-invite-grid">
        <label className="field-stack">
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.emailLabel}</span>
          <input
            name="email"
            type="email"
            placeholder={m.emailPlaceholder}
            required
          />
        </label>

        <label className="field-stack">
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{m.roleLabel}</span>
          <select name="role" defaultValue="viewer">
            <option value="admin">{m.roles.admin}</option>
            <option value="dispatcher">{m.roles.dispatcher}</option>
            <option value="crew">{m.roles.crew}</option>
            <option value="viewer">{m.roles.viewer}</option>
          </select>
        </label>

        <button type="submit" className="primary-btn team-invite-submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>

      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          aria-live={state.ok ? "polite" : "assertive"}
          className={`badge ${state.ok ? "success" : "warning"}`}
          style={{ marginTop: 10 }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getTeamData } from "@/lib/team/data";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { TeamMemberCard } from "@/components/team/team-member-card";
import { PendingInviteCard } from "@/components/team/pending-invite-card";
import { getTranslator } from "@/lib/i18n/server";

export default async function TeamPage() {
  const [team, { messages: m, t }] = await Promise.all([getTeamData(), getTranslator()]);
  const canManage = team.currentUserRole === "owner" || team.currentUserRole === "admin";

  return (
    <DashboardShell
      title={m.dashboard.team.title}
      description={m.dashboard.team.description}
    >
      <div className="dashboard-grid">
        <section>
          {canManage && (
            <div className="panel" style={{ marginBottom: 18 }}>
              <div className="section-header">
                <div>
                  <div className="kicker">{m.dashboard.team.kickerAdd}</div>
                  <h2 className="page-title-sm">{m.dashboard.team.sectionInvite}</h2>
                </div>
              </div>
              <InviteMemberForm />
            </div>
          )}

          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">{m.dashboard.team.kickerActive}</div>
                <h2 className="page-title-sm">
                  {t(m.dashboard.team.teamCount, { count: team.members.length })}
                </h2>
              </div>
            </div>

            <div className="list">
              {team.members.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  canManage={canManage}
                />
              ))}
            </div>
          </div>
        </section>

        <aside>
          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">{m.dashboard.team.kickerPending}</div>
                <h2 className="page-title-sm">{m.dashboard.team.invitesTitle}</h2>
              </div>
            </div>

            {team.invites.length === 0 ? (
              <div className="muted">{m.dashboard.team.pendingNone}</div>
            ) : (
              <div className="list">
                {team.invites.map((invite) => (
                  <PendingInviteCard
                    key={invite.id}
                    invite={invite}
                    canManage={canManage}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="section-header">
              <div>
                <div className="kicker">{m.dashboard.team.kickerRoles}</div>
                <h2 className="page-title-sm">{m.dashboard.team.sectionPermissions}</h2>
              </div>
            </div>
            <div className="list">
              <div className="order-card">
                <strong>{m.dashboard.team.roles.owner}</strong>
                <div className="muted">{m.dashboard.team.roles.ownerBody}</div>
              </div>
              <div className="order-card">
                <strong>{m.dashboard.team.roles.admin}</strong>
                <div className="muted">{m.dashboard.team.roles.adminBody}</div>
              </div>
              <div className="order-card">
                <strong>{m.dashboard.team.roles.dispatcher}</strong>
                <div className="muted">{m.dashboard.team.roles.dispatcherBody}</div>
              </div>
              <div className="order-card">
                <strong>{m.dashboard.team.roles.crew}</strong>
                <div className="muted">{m.dashboard.team.roles.crewBody}</div>
              </div>
              <div className="order-card">
                <strong>{m.dashboard.team.roles.viewer}</strong>
                <div className="muted">{m.dashboard.team.roles.viewerBody}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

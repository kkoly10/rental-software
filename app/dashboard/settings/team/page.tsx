import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getTeamData } from "@/lib/team/data";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { TeamMemberCard } from "@/components/team/team-member-card";
import { PendingInviteCard } from "@/components/team/pending-invite-card";

export default async function TeamPage() {
  const team = await getTeamData();
  const canManage = team.currentUserRole === "owner" || team.currentUserRole === "admin";

  return (
    <DashboardShell
      title="Team"
      description="Manage team members and their roles."
    >
      <div className="dashboard-grid">
        <section>
          {canManage && (
            <div className="panel" style={{ marginBottom: 18 }}>
              <div className="section-header">
                <div>
                  <div className="kicker">Add member</div>
                  <h2 style={{ margin: "6px 0 0" }}>Invite a team member</h2>
                </div>
              </div>
              <InviteMemberForm />
            </div>
          )}

          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Active members</div>
                <h2 style={{ margin: "6px 0 0" }}>
                  Team ({team.members.length})
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
                <div className="kicker">Pending</div>
                <h2 style={{ margin: "6px 0 0" }}>Invites</h2>
              </div>
            </div>

            {team.invites.length === 0 ? (
              <div className="muted">No pending invites.</div>
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
                <div className="kicker">Roles guide</div>
                <h2 style={{ margin: "6px 0 0" }}>Permissions</h2>
              </div>
            </div>
            <div className="list">
              <div className="order-card">
                <strong>Owner</strong>
                <div className="muted">Full access. Billing, team, settings, all data.</div>
              </div>
              <div className="order-card">
                <strong>Admin</strong>
                <div className="muted">Everything except billing and ownership transfer.</div>
              </div>
              <div className="order-card">
                <strong>Dispatcher</strong>
                <div className="muted">Orders, deliveries, calendar, customers. No settings.</div>
              </div>
              <div className="order-card">
                <strong>Crew</strong>
                <div className="muted">Crew mobile view only. Delivery stops and checklists.</div>
              </div>
              <div className="order-card">
                <strong>Viewer</strong>
                <div className="muted">Read-only access to orders, products, and customers.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

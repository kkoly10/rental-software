import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { BookingPoliciesForm } from "@/components/settings/booking-policies-form";
import { SmsSettingsForm } from "@/components/settings/sms-settings-form";
import { SmsLog } from "@/components/settings/sms-log";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgSettings } from "@/lib/data/settings";
import { getSmsSettings } from "@/lib/data/sms-settings";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";

export default async function SettingsPage() {
  const [orgSettings, editableSettings, smsSettings, bookingPolicies] = await Promise.all([
    getOrganizationSettings(),
    getOrgSettings(),
    getSmsSettings(),
    getBookingPolicies(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/settings"];

  return (
    <DashboardShell
      title="Settings"
      description="Manage business preferences, support details, and booking defaults."
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Business settings</div>
              <h2 style={{ margin: "6px 0 0" }}>Business profile</h2>
            </div>
          </div>

          <BusinessProfileForm
            defaults={{
              name: editableSettings.name || orgSettings.businessName,
              supportEmail: editableSettings.supportEmail || orgSettings.supportEmail,
              phone: editableSettings.phone || orgSettings.phone,
              timezone: editableSettings.timezone || orgSettings.timezone,
            }}
          />
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Current snapshot</div>
              <h2 style={{ margin: "6px 0 0" }}>Active configuration</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>Regional defaults</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Timezone: {orgSettings.timezone}
              </div>
              <div className="muted">Currency: {orgSettings.currency}</div>
              <div className="muted">
                Service areas: {orgSettings.serviceAreaLabel}
              </div>
            </article>

            <article className="order-card">
              <strong>Booking policies</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Deposit: {bookingPolicies.depositPercentage}%
                {bookingPolicies.depositMinimum ? ` (min $${bookingPolicies.depositMinimum})` : ""}
              </div>
              <div className="muted">
                Lead time: {bookingPolicies.bookingLeadTimeHours}h · Max advance: {bookingPolicies.maxAdvanceBookingDays} days
              </div>
              <div className="muted">
                {bookingPolicies.requireDepositToConfirm ? "Deposit required to confirm" : "Auto-confirm on booking"}
              </div>
            </article>
          </div>

          <div className="section-header" style={{ marginTop: 18 }}>
            <div>
              <div className="kicker">Quick links</div>
            </div>
          </div>
          <div className="list">
            <a href="/dashboard/settings/team" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>Team access</strong>
              <div className="muted">Invite members and manage roles: owner, admin, dispatcher, crew, viewer.</div>
            </a>
            <a href="/dashboard/settings/billing" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>Billing</strong>
              <div className="muted">Manage your subscription plan and payment method.</div>
            </a>
            <a href="#sms-notifications" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>SMS Notifications</strong>
              <div className="muted">Configure text message alerts for customers.</div>
            </a>
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Policies</div>
              <h2 style={{ margin: "6px 0 0" }}>Booking Policies</h2>
            </div>
          </div>

          <BookingPoliciesForm defaults={bookingPolicies} />
        </section>
      </div>

      <div className="dashboard-grid" id="sms-notifications" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Notifications</div>
              <h2 style={{ margin: "6px 0 0" }}>SMS Notifications</h2>
            </div>
          </div>

          <SmsSettingsForm defaults={smsSettings} />
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Activity</div>
              <h2 style={{ margin: "6px 0 0" }}>Recent SMS messages</h2>
            </div>
          </div>

          <SmsLog />
        </aside>
      </div>
    </DashboardShell>
  );
}

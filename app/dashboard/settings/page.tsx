import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { BookingPoliciesForm } from "@/components/settings/booking-policies-form";
import { SmsSettingsForm } from "@/components/settings/sms-settings-form";
import { SmsLog } from "@/components/settings/sms-log";
import { getSmsLog } from "@/lib/data/sms-log";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgSettings } from "@/lib/data/settings";
import { getSmsSettings } from "@/lib/data/sms-settings";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { EnvStatusChecklist } from "@/components/settings/env-status-checklist";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { getMessages } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

export default async function SettingsPage() {
  const [orgSettings, editableSettings, smsSettings, bookingPolicies, smsLog, m] = await Promise.all([
    getOrganizationSettings(),
    getOrgSettings(),
    getSmsSettings(),
    getBookingPolicies(),
    getSmsLog(),
    getMessages(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/settings"];

  return (
    <DashboardShell
      title={m.dashboard.settings.title}
      description={m.dashboard.settings.description}
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}
      <EnvStatusChecklist />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.settings.kickerBusiness}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.settings.sections.profile}</h2>
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
              <div className="kicker">{m.dashboard.settings.kickerSnapshot}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.settings.activeConfiguration}</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>{m.dashboard.settings.regionalDefaultsCardTitle}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {formatMessage(m.dashboard.settings.timezoneLabel, { value: orgSettings.timezone })}
              </div>
              <div className="muted">{formatMessage(m.dashboard.settings.currencyLabel, { value: orgSettings.currency })}</div>
              <div className="muted">
                {formatMessage(m.dashboard.settings.serviceAreasLabel, { value: orgSettings.serviceAreaLabel })}
              </div>
            </article>

            <article className="order-card">
              <strong>{m.dashboard.settings.bookingPoliciesCardTitle}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {formatMessage(m.dashboard.settings.depositLabel, { value: bookingPolicies.depositPercentage })}
                {bookingPolicies.depositMinimum
                  ? formatMessage(m.dashboard.settings.depositMinSuffix, { value: bookingPolicies.depositMinimum })
                  : ""}
              </div>
              <div className="muted">
                {formatMessage(m.dashboard.settings.leadTimeAndMaxAdvance, {
                  leadTime: bookingPolicies.bookingLeadTimeHours,
                  maxAdvance: bookingPolicies.maxAdvanceBookingDays,
                })}
              </div>
              <div className="muted">
                {bookingPolicies.requireDepositToConfirm
                  ? m.dashboard.settings.depositRequiredToConfirm
                  : m.dashboard.settings.autoConfirmOnBooking}
              </div>
            </article>
          </div>

          <div className="section-header" style={{ marginTop: 18 }}>
            <div>
              <div className="kicker">{m.dashboard.settings.kickerLinks}</div>
            </div>
          </div>
          <div className="list">
            <a href="/dashboard/settings/team" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>{m.dashboard.settings.teamAccessTitle}</strong>
              <div className="muted">{m.dashboard.settings.teamAccessBody}</div>
            </a>
            <a href="/dashboard/settings/billing" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>{m.dashboard.settings.billingTitle}</strong>
              <div className="muted">{m.dashboard.settings.billingBody}</div>
            </a>
            <a href="#sms-notifications" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>{m.dashboard.settings.smsNotificationsLinkTitle}</strong>
              <div className="muted">{m.dashboard.settings.smsNotificationsLinkBody}</div>
            </a>
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.settings.kickerPolicies}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.settings.bookingPoliciesTitle}</h2>
            </div>
          </div>

          <BookingPoliciesForm defaults={bookingPolicies} />
        </section>
      </div>

      <div className="dashboard-grid" id="sms-notifications" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.settings.kickerNotifications}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.settings.smsNotificationsTitle}</h2>
            </div>
          </div>

          <SmsSettingsForm defaults={smsSettings} />
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.settings.kickerActivity}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.settings.recentSmsMessages}</h2>
            </div>
          </div>

          <SmsLog entries={smsLog} />
        </aside>
      </div>
      <div style={{ marginTop: 48 }}>
        <DeleteAccountCard />
      </div>
    </DashboardShell>
  );
}

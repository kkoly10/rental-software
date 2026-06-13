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
import { RoutingModeForm } from "@/components/settings/routing-mode-form";
import { QuickBooksCard } from "@/components/settings/quickbooks-card";
import { XeroCard } from "@/components/settings/xero-card";
import { WhatsAppSettingsForm } from "@/components/settings/whatsapp-settings-form";
import { getRoutingMode } from "@/lib/data/routing-mode";
import { getQuickBooksStatus } from "@/lib/data/quickbooks-status";
import { getXeroStatus } from "@/lib/data/xero-status";
import { getWhatsAppSettings } from "@/lib/data/whatsapp-settings";
import { getMessages } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import { listOrgVerticalSlugs } from "@/lib/verticals/org-verticals";
import { listVerticalSlugs } from "@/lib/verticals/registry";
import { AddVerticalForm } from "@/components/settings/add-vertical-form";
import { RemoveVerticalButton } from "@/components/settings/remove-vertical-button";
import { SetPrimaryButton } from "@/components/settings/set-primary-button";

const QBO_BANNERS: Record<string, { tone: "success" | "warning"; copy: string }> = {
  connected: { tone: "success", copy: "QuickBooks connected. Paid invoices will sync automatically." },
  disconnected: { tone: "success", copy: "QuickBooks disconnected." },
  not_configured: { tone: "warning", copy: "QuickBooks integration isn't configured on this deploy." },
  forbidden: { tone: "warning", copy: "Only owners and admins can manage QuickBooks." },
  missing_params: { tone: "warning", copy: "QuickBooks callback was missing parameters. Try connecting again." },
  state_mismatch: { tone: "warning", copy: "Security check failed during QuickBooks callback. Try again from this page." },
  token_exchange_failed: { tone: "warning", copy: "QuickBooks rejected the connection. Reconnect and try again." },
  persist_failed: { tone: "warning", copy: "Couldn't save the QuickBooks connection. Try again." },
  error: { tone: "warning", copy: "QuickBooks returned an error during the connection." },
};

const XERO_BANNERS: Record<string, { tone: "success" | "warning"; copy: string }> = {
  connected: { tone: "success", copy: "Xero connected. Paid invoices will sync automatically." },
  disconnected: { tone: "success", copy: "Xero disconnected." },
  not_configured: { tone: "warning", copy: "Xero integration isn't configured on this deploy." },
  forbidden: { tone: "warning", copy: "Only owners and admins can manage Xero." },
  missing_params: { tone: "warning", copy: "Xero callback was missing parameters. Try connecting again." },
  state_mismatch: { tone: "warning", copy: "Security check failed during Xero callback. Try again from this page." },
  token_exchange_failed: { tone: "warning", copy: "Xero rejected the connection. Reconnect and try again." },
  no_tenant: { tone: "warning", copy: "Xero didn't return a tenant. Make sure you authorized at least one organization." },
  persist_failed: { tone: "warning", copy: "Couldn't save the Xero connection. Try again." },
  error: { tone: "warning", copy: "Xero returned an error during the connection." },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ qbo?: string; xero?: string }>;
}) {
  const params = await searchParams;
  const qboBanner = params.qbo ? QBO_BANNERS[params.qbo] : undefined;
  const xeroBanner = params.xero ? XERO_BANNERS[params.xero] : undefined;
  const [orgSettings, editableSettings, smsSettings, bookingPolicies, smsLog, routingMode, qbStatus, xeroStatus, whatsappSettings, m, verticalSlugs] = await Promise.all([
    getOrganizationSettings(),
    getOrgSettings(),
    getSmsSettings(),
    getBookingPolicies(),
    getSmsLog(),
    getRoutingMode(),
    getQuickBooksStatus(),
    getXeroStatus(),
    getWhatsAppSettings(),
    getMessages(),
    listOrgVerticalSlugs(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/settings"];
  // SMS is a Pro-tier feature — lock the settings form below Pro.
  const { checkFeatureAccess } = await import("@/lib/stripe/gate");
  const smsLocked = !(await checkFeatureAccess("sms")).allowed;

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
              addressLine1: editableSettings.businessAddressLine1,
              addressLine2: editableSettings.businessAddressLine2,
              city: editableSettings.businessCity,
              state: editableSettings.businessState,
              postalCode: editableSettings.businessPostalCode,
              representativeName: editableSettings.businessRepresentativeName,
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

            {/* Phase 4c — verticals snapshot. Renders one chip per
                row on organization_verticals (with primary first via
                listOrgVerticalSlugs). Hidden when the join table is
                empty AND no business_type fallback fires, so legacy
                orgs we haven't backfilled aren't shown an empty card. */}
            {verticalSlugs.length > 0 && (
              <article className="order-card">
                <strong>Verticals</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  This org rents:
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  {verticalSlugs.map((slug, i) => {
                    // listOrgVerticalSlugs places the primary first, so
                    // index 0 with > 1 slug is the only "(primary)" chip.
                    // Single-vertical orgs have no primary suffix but
                    // also no remove button — there'd be nothing left.
                    const isPrimary = i === 0 && verticalSlugs.length > 1;
                    const canRemove = !isPrimary && verticalSlugs.length > 1;
                    return (
                      <span
                        key={slug}
                        className="badge"
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          textTransform: "capitalize",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        {slug.replace(/-/g, " ")}
                        {isPrimary ? " (primary)" : ""}
                        {!isPrimary && verticalSlugs.length > 1 && (
                          <SetPrimaryButton slug={slug} />
                        )}
                        {canRemove && <RemoveVerticalButton slug={slug} />}
                      </span>
                    );
                  })}
                </div>
                {/* Phase 4e — add-vertical picker. The registry's
                    remaining slugs are passed down so the operator
                    can only add what they don't already declare. */}
                <AddVerticalForm
                  remainingSlugs={listVerticalSlugs().filter(
                    (s) => !verticalSlugs.includes(s),
                  )}
                />
              </article>
            )}

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
            <a href="/dashboard/settings/documents" className="order-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>Document templates</strong>
              <div className="muted">Edit the clauses on your rental agreement and safety waiver.</div>
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

          <SmsSettingsForm defaults={smsSettings} locked={smsLocked} />

          <div style={{ marginTop: 24 }}>
            <div className="kicker">WhatsApp</div>
            <h3 style={{ margin: "6px 0 12px" }}>WhatsApp Business</h3>
            <WhatsAppSettingsForm defaults={whatsappSettings} />
          </div>
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
      <div style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.settings.routingMode.kicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.settings.routingMode.title}</h2>
            </div>
          </div>
          <RoutingModeForm currentMode={routingMode} />
        </section>
      </div>

      <div style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Integrations</div>
              <h2 style={{ margin: "6px 0 0" }}>Accounting sync</h2>
            </div>
          </div>
          {qboBanner && (
            <div
              className={`badge ${qboBanner.tone}`}
              role={qboBanner.tone === "warning" ? "alert" : undefined}
              style={{ marginBottom: 12, display: "inline-block", fontSize: 12 }}
            >
              {qboBanner.copy}
            </div>
          )}
          {xeroBanner && (
            <div
              className={`badge ${xeroBanner.tone}`}
              role={xeroBanner.tone === "warning" ? "alert" : undefined}
              style={{ marginBottom: 12, display: "inline-block", fontSize: 12, marginLeft: 8 }}
            >
              {xeroBanner.copy}
            </div>
          )}
          <div className="list">
            <QuickBooksCard status={qbStatus} />
            <XeroCard status={xeroStatus} />
          </div>
        </section>
      </div>

      <div style={{ marginTop: 48 }}>
        <DeleteAccountCard />
      </div>
    </DashboardShell>
  );
}

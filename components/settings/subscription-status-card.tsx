"use client";

import { PLAN_TIERS } from "@/lib/stripe/config";
import type { SubscriptionInfo } from "@/lib/stripe/subscription";
import { BillingPortalButton } from "./billing-portal-button";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const statusKeyMap: Record<
  string,
  {
    key: "active" | "trialing" | "pastDue" | "canceled" | "unpaid" | "none";
    tone: string;
  }
> = {
  active: { key: "active", tone: "success" },
  trialing: { key: "trialing", tone: "default" },
  past_due: { key: "pastDue", tone: "danger" },
  canceled: { key: "canceled", tone: "warning" },
  unpaid: { key: "unpaid", tone: "danger" },
  none: { key: "none", tone: "warning" },
};

export function SubscriptionStatusCard({
  subscription,
}: {
  subscription: SubscriptionInfo;
}) {
  const { locale, messages } = useI18n();
  const m = messages.forms.subscriptionStatus;
  const planNames = messages.forms.planSelector.planNames;

  const planConfig = subscription.plan ? PLAN_TIERS[subscription.plan] : null;
  const planLabel = subscription.plan ? planNames[subscription.plan] : null;
  const statusEntry = statusKeyMap[subscription.status] ?? statusKeyMap.none;
  const statusLabel = m.statuses[statusEntry.key];

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <div className="kicker">{m.kicker}</div>
          <h2 style={{ margin: "6px 0 0" }}>
            {planLabel ? formatMessage(m.planHeading, { plan: planLabel }) : m.noActivePlan}
          </h2>
        </div>
        <span className={`badge ${statusEntry.tone}`}>{statusLabel}</span>
      </div>

      {subscription.hasActiveSubscription && planConfig ? (
        <div className="list" style={{ marginTop: 12 }}>
          <div className="order-card">
            <div className="order-row">
              <div>
                <strong>{m.planLimitsHeading}</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  {subscription.limits.products === Infinity
                    ? m.unlimited
                    : subscription.limits.products}{" "}
                  {m.productsLabel} &middot;{" "}
                  {subscription.limits.ordersPerMonth === Infinity
                    ? m.unlimited
                    : subscription.limits.ordersPerMonth}{" "}
                  {m.ordersPerMonthLabel} &middot;{" "}
                  {subscription.limits.teamMembers}{" "}
                  {subscription.limits.teamMembers > 1
                    ? m.teamMembersLabel
                    : m.teamMemberLabel}
                </div>
              </div>
            </div>
          </div>

          {periodEnd && (
            <div className="order-card">
              <strong>{m.nextBillingHeading}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {periodEnd}
              </div>
            </div>
          )}

          <BillingPortalButton />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p className="muted">
            {subscription.status === "canceled"
              ? m.canceledMessage
              : subscription.status === "past_due"
                ? m.pastDueMessage
                : m.defaultMessage}
          </p>

          {subscription.status === "past_due" && <BillingPortalButton />}
        </div>
      )}
    </div>
  );
}

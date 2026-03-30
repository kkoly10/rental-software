"use client";

import { PLAN_TIERS } from "@/lib/stripe/config";
import type { SubscriptionInfo } from "@/lib/stripe/subscription";
import { BillingPortalButton } from "./billing-portal-button";

const statusLabels: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trial", tone: "default" },
  past_due: { label: "Past Due", tone: "danger" },
  canceled: { label: "Canceled", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "danger" },
  none: { label: "No Plan", tone: "warning" },
};

export function SubscriptionStatusCard({
  subscription,
}: {
  subscription: SubscriptionInfo;
}) {
  const planConfig = subscription.plan ? PLAN_TIERS[subscription.plan] : null;
  const statusInfo = statusLabels[subscription.status] ?? statusLabels.none;

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <div className="kicker">Current subscription</div>
          <h2 style={{ margin: "6px 0 0" }}>
            {planConfig ? `${planConfig.name} Plan` : "No active plan"}
          </h2>
        </div>
        <span className={`badge ${statusInfo.tone}`}>{statusInfo.label}</span>
      </div>

      {subscription.hasActiveSubscription && planConfig ? (
        <div className="list" style={{ marginTop: 12 }}>
          <div className="order-card">
            <div className="order-row">
              <div>
                <strong>Plan limits</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  {subscription.limits.products === Infinity
                    ? "Unlimited"
                    : subscription.limits.products}{" "}
                  products &middot;{" "}
                  {subscription.limits.ordersPerMonth === Infinity
                    ? "Unlimited"
                    : subscription.limits.ordersPerMonth}{" "}
                  orders/mo &middot;{" "}
                  {subscription.limits.teamMembers} team member
                  {subscription.limits.teamMembers > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          {periodEnd && (
            <div className="order-card">
              <strong>Next billing date</strong>
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
              ? "Your subscription has been canceled. Choose a plan below to resubscribe."
              : subscription.status === "past_due"
                ? "Your payment is past due. Please update your payment method."
                : "Choose a plan below to unlock all features and start growing your rental business."}
          </p>

          {subscription.status === "past_due" && <BillingPortalButton />}
        </div>
      )}
    </div>
  );
}

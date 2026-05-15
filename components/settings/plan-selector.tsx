"use client";

import { useState, useActionState } from "react";
import { PLAN_TIERS, formatPrice, type PlanTier } from "@/lib/stripe/config";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const tiers: { key: PlanTier; plan: (typeof PLAN_TIERS)[PlanTier] }[] = [
  { key: "starter", plan: PLAN_TIERS.starter },
  { key: "pro", plan: PLAN_TIERS.pro },
  { key: "growth", plan: PLAN_TIERS.growth },
];

export function PlanSelector({
  currentPlan,
  interval: defaultInterval,
}: {
  currentPlan: PlanTier | null;
  interval: "monthly" | "yearly";
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">(defaultInterval);
  const [state, formAction, pending] = useActionState(createCheckoutSession, {
    ok: true,
    message: "",
  });
  const { messages } = useI18n();
  const m = messages.forms.planSelector;

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <div className="kicker">
            {currentPlan ? m.kickerChange : m.kickerChoose}
          </div>
          <h2 style={{ margin: "6px 0 0" }}>{m.heading}</h2>
        </div>

        <div
          style={{
            display: "inline-flex",
            background: "var(--surface-muted)",
            borderRadius: 999,
            padding: 3,
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={interval === "monthly" ? "primary-btn" : "ghost-btn"}
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            {m.monthly}
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={interval === "yearly" ? "primary-btn" : "ghost-btn"}
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            {m.yearly}
          </button>
        </div>
      </div>

      {!state.ok && state.message && (
        <div className="badge warning" style={{ marginBottom: 12 }}>
          {state.message}
        </div>
      )}

      <div className="grid grid-3" style={{ marginTop: 12 }}>
        {tiers.map(({ key, plan }) => {
          const price = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          const isCurrent = currentPlan === key;
          const isPopular = "popular" in plan && plan.popular;
          const planName = m.planNames[key];
          const features = m.planFeatures[key];

          return (
            <div
              key={key}
              className="order-card"
              style={{
                border: isCurrent
                  ? "2px solid var(--accent)"
                  : isPopular
                    ? "2px solid var(--primary)"
                    : undefined,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="kicker">{planName}</div>
                {isCurrent && <span className="badge success">{m.current}</span>}
                {!isCurrent && isPopular && <span className="badge">{m.popular}</span>}
              </div>

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: "1.8rem", fontWeight: 800 }}>
                  {formatPrice(price)}
                </span>
                <span className="muted">{m.perMonth}</span>
              </div>

              <div style={{ marginTop: 12, flex: 1 }}>
                {features.slice(0, 4).map((f) => (
                  <div key={f} className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                    &#10003; {f}
                  </div>
                ))}
                {features.length > 4 && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {formatMessage(m.moreFeatures, { count: features.length - 4 })}
                  </div>
                )}
              </div>

              {isCurrent ? (
                <button
                  type="button"
                  className="secondary-btn"
                  disabled
                  style={{ marginTop: 14, width: "100%", opacity: 0.5 }}
                >
                  {m.currentPlan}
                </button>
              ) : (
                <form action={formAction}>
                  <input type="hidden" name="tier" value={key} />
                  <input type="hidden" name="interval" value={interval} />
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={pending}
                    style={{ marginTop: 14, width: "100%" }}
                  >
                    {pending
                      ? m.loading
                      : currentPlan
                        ? formatMessage(m.switchTo, { plan: planName })
                        : formatMessage(m.startTrial, { plan: planName })}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

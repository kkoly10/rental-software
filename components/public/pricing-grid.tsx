"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_TIERS, formatPrice, type PlanTier } from "@/lib/stripe/config";

const tiers: { key: PlanTier; plan: (typeof PLAN_TIERS)[PlanTier] }[] = [
  { key: "starter", plan: PLAN_TIERS.starter },
  { key: "pro", plan: PLAN_TIERS.pro },
  { key: "growth", plan: PLAN_TIERS.growth },
];

/**
 * Live plan cards for /pricing, fed by PLAN_TIERS (the Stripe source of
 * truth) with a monthly/yearly interval toggle. Styled with the mk-*
 * editorial marketing system — must be rendered inside an `.mk-page`.
 */
export function PricingGrid() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  return (
    <div>
      {/* Interval toggle */}
      <div className="mk-toggle-row">
        <div className="mk-toggle" role="group" aria-label="Billing interval">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={interval === "monthly" ? "mk-toggle-on" : ""}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={interval === "yearly" ? "mk-toggle-on" : ""}
          >
            Yearly
            <span className="mk-toggle-badge">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="mk-pricing-grid">
        {tiers.map(({ key, plan }) => {
          const price = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          const isPopular = "popular" in plan && plan.popular;

          return (
            <div key={key} className={`mk-plan${isPopular ? " mk-plan--popular" : ""}`}>
              {isPopular && <span className="mk-plan-tag">Most Popular</span>}
              <h3>{plan.name}</h3>
              <div className="mk-plan-price">
                {formatPrice(price)}
                <span>
                  {" "}
                  / mo{interval === "yearly" ? " · billed yearly" : ""}
                </span>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mk-btn ${isPopular ? "mk-btn--accent" : "mk-btn--outline"}`}
                style={{ width: "100%" }}
              >
                Start Free Trial
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

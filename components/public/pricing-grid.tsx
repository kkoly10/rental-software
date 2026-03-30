"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_TIERS, formatPrice, type PlanTier } from "@/lib/stripe/config";

const tiers: { key: PlanTier; plan: (typeof PLAN_TIERS)[PlanTier] }[] = [
  { key: "starter", plan: PLAN_TIERS.starter },
  { key: "pro", plan: PLAN_TIERS.pro },
  { key: "growth", plan: PLAN_TIERS.growth },
];

export function PricingGrid() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  return (
    <div>
      {/* Interval Toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <div
          style={{
            display: "inline-flex",
            background: "var(--surface-muted)",
            borderRadius: 999,
            padding: 4,
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: interval === "monthly" ? "var(--primary)" : "transparent",
              color: interval === "monthly" ? "white" : "var(--text-soft)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "0.15s ease",
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: interval === "yearly" ? "var(--primary)" : "transparent",
              color: interval === "yearly" ? "white" : "var(--text-soft)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "0.15s ease",
            }}
          >
            Yearly
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                background: interval === "yearly" ? "rgba(255,255,255,0.2)" : "var(--accent)",
                color: interval === "yearly" ? "white" : "white",
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-3">
        {tiers.map(({ key, plan }) => {
          const price = interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          const isPopular = "popular" in plan && plan.popular;

          return (
            <div
              key={key}
              className="panel"
              style={{
                position: "relative",
                border: isPopular ? "2px solid var(--primary)" : "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {isPopular && (
                <div
                  style={{
                    position: "absolute",
                    top: -13,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--primary)",
                    color: "white",
                    padding: "4px 16px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Most Popular
                </div>
              )}

              <div className="kicker" style={{ marginTop: isPopular ? 8 : 0 }}>
                {plan.name}
              </div>

              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1 }}>
                  {formatPrice(price)}
                </span>
                <span className="muted" style={{ marginLeft: 4 }}>
                  / mo{interval === "yearly" ? " (billed yearly)" : ""}
                </span>
              </div>

              <div style={{ marginTop: 20, flex: 1 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
                    >
                      <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 16 }}>
                        &#10003;
                      </span>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/signup"
                className="primary-btn"
                style={{
                  marginTop: 24,
                  width: "100%",
                  textAlign: "center",
                  background: isPopular ? "var(--primary)" : "var(--surface)",
                  color: isPopular ? "white" : "var(--text)",
                  border: isPopular ? "none" : "1px solid var(--border)",
                }}
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

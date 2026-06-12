"use client";

import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { dismissMilestone } from "@/lib/guidance/actions";

type MilestoneKey =
  | "first_product"
  | "first_order"
  | "first_payment"
  | "first_delivery"
  | "setup_complete"
  | "ten_orders";

const MILESTONE_KEY_MAP: Record<
  MilestoneKey,
  "firstProduct" | "firstOrder" | "firstPayment" | "firstDelivery" | "setupComplete" | "tenOrders"
> = {
  first_product: "firstProduct",
  first_order: "firstOrder",
  first_payment: "firstPayment",
  first_delivery: "firstDelivery",
  setup_complete: "setupComplete",
  ten_orders: "tenOrders",
};

export function MilestoneCelebration({
  milestoneKey,
}: {
  milestoneKey: MilestoneKey;
}) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const { messages: m } = useI18n();
  const mappedKey = MILESTONE_KEY_MAP[milestoneKey];
  const config = mappedKey ? m.milestones[mappedKey] : null;
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Persist immediately on first render — each milestone celebrates
    // exactly once. Without this the toast re-fired on every dashboard
    // visit forever ("First product added!" months after the fact),
    // because the 6s auto-hide and the × button were client-state only.
    dismissMilestone(milestoneKey);

    const timer = setTimeout(() => {
      setExiting(true);
      exitTimerRef.current = setTimeout(() => setVisible(false), 400);
    }, 6000);
    return () => {
      clearTimeout(timer);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [milestoneKey]);

  if (!visible || !config) return null;

  function handleDismiss() {
    setExiting(true);
    exitTimerRef.current = setTimeout(() => setVisible(false), 400);
  }

  return (
    <div
      className={`milestone-toast ${exiting ? "milestone-toast-exit" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="milestone-icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="16" cy="16" r="16" fill="#f0fdf4" />
          <circle cx="16" cy="16" r="12" fill="#bbf7d0" />
          <path
            d="M12 16.5l3 3 5.5-6"
            stroke="#15803d"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <strong className="milestone-title">{config.title}</strong>
        <div className="milestone-description">{config.description}</div>
      </div>
      <button
        onClick={handleDismiss}
        className="milestone-close"
        aria-label={m.common.dismiss}
      >
        &times;
      </button>
    </div>
  );
}

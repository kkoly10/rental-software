"use client";

import { useState, useEffect } from "react";

type MilestoneKey =
  | "first_product"
  | "first_order"
  | "first_payment"
  | "first_delivery"
  | "setup_complete"
  | "ten_orders";

const MILESTONE_CONFIG: Record<
  MilestoneKey,
  { title: string; description: string }
> = {
  first_product: {
    title: "First product added!",
    description: "Your rental catalog is live. Customers can now browse it.",
  },
  first_order: {
    title: "First order received!",
    description:
      "Your first booking is in. This is a big deal — you're officially open for business.",
  },
  first_payment: {
    title: "First payment recorded!",
    description: "Money is flowing. Your invoicing workflow is up and running.",
  },
  first_delivery: {
    title: "First delivery scheduled!",
    description:
      "Your crew has a route. Delivery day logistics are dialed in.",
  },
  setup_complete: {
    title: "Setup complete!",
    description:
      "You've finished every step. Your storefront is fully operational.",
  },
  ten_orders: {
    title: "10 orders milestone!",
    description:
      "Double digits! Your rental business is building real momentum.",
  },
};

export function MilestoneCelebration({
  milestoneKey,
}: {
  milestoneKey: MilestoneKey;
}) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const config = MILESTONE_CONFIG[milestoneKey];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => setVisible(false), 400);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible || !config) return null;

  function handleDismiss() {
    setExiting(true);
    setTimeout(() => setVisible(false), 400);
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
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

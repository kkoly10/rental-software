"use client";

import { useState, useTransition } from "react";
import { markWelcomeSeen } from "@/lib/guidance/actions";

export function WelcomeModal({
  onStartTour,
}: {
  onStartTour: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    startTransition(() => {
      markWelcomeSeen();
    });
  }

  function handleStartTour() {
    close();
    onStartTour();
  }

  if (!open) return null;

  return (
    <div className="welcome-overlay" onClick={close}>
      <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-header">
          <div className="welcome-icon">&#9889;</div>
          <h2 style={{ margin: "12px 0 6px", fontSize: "1.6rem" }}>Welcome to RentalOS</h2>
          <p className="muted" style={{ maxWidth: 420, margin: "0 auto" }}>
            Your inflatable rental business is ready. Here&rsquo;s how to get the most out of your dashboard.
          </p>
        </div>

        <div className="welcome-actions">
          <button
            className="welcome-action-card"
            onClick={handleStartTour}
            disabled={isPending}
          >
            <strong>Take a quick tour</strong>
            <span className="muted">2-minute walkthrough of key features</span>
          </button>

          <a href="/dashboard/help" className="welcome-action-card" onClick={close}>
            <strong>Read the Help Center</strong>
            <span className="muted">Articles on every feature and workflow</span>
          </a>

          <a href="/dashboard/settings" className="welcome-action-card" onClick={close}>
            <strong>Complete your profile</strong>
            <span className="muted">Add contact info and business details</span>
          </a>
        </div>

        <button
          className="ghost-btn"
          onClick={close}
          disabled={isPending}
          style={{ marginTop: 8, width: "100%", textAlign: "center" }}
        >
          Skip for now — I&rsquo;ll explore on my own
        </button>
      </div>
    </div>
  );
}

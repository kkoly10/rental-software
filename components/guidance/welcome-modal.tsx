"use client";

import { useState, useTransition } from "react";
import { markWelcomeSeen } from "@/lib/guidance/actions";
import type { MiniTour } from "@/lib/guidance/tour-config";

export function WelcomeModal({
  businessName,
  miniTours,
  onStartTour,
}: {
  businessName?: string;
  miniTours: MiniTour[];
  onStartTour: (tourId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    startTransition(() => {
      markWelcomeSeen();
    });
  }

  function handleStartTour(tourId: string) {
    close();
    onStartTour(tourId);
  }

  if (!open) return null;

  const greeting = businessName
    ? `Welcome to ${businessName}!`
    : "Welcome to Your Dashboard!";

  return (
    <div className="welcome-overlay" onClick={close}>
      <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-header">
          <div className="welcome-icon">&#9889;</div>
          <h2 style={{ margin: "12px 0 6px", fontSize: "1.6rem" }}>
            {greeting}
          </h2>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto" }}>
            Your rental business is ready. Pick a quick tour below, or jump
            straight in — you can always start a tour later from the Help Center.
          </p>
        </div>

        <div className="welcome-tour-picks">
          <div className="kicker" style={{ marginBottom: 10, fontSize: 11 }}>
            What do you want to do first?
          </div>

          {miniTours.map((tour) => (
            <button
              key={tour.id}
              className="welcome-action-card"
              onClick={() => handleStartTour(tour.id)}
              disabled={isPending}
            >
              <strong>{tour.name}</strong>
              <span className="muted">{tour.description}</span>
            </button>
          ))}
        </div>

        <div className="welcome-alt-actions">
          <a href="/dashboard/help" className="welcome-alt-link" onClick={close}>
            Help Center
          </a>
          <span className="muted">or</span>
          <a href="/dashboard/settings" className="welcome-alt-link" onClick={close}>
            Complete your profile
          </a>
        </div>

        <button
          className="ghost-btn"
          onClick={close}
          disabled={isPending}
          style={{ marginTop: 12, width: "100%", textAlign: "center" }}
        >
          Skip — I&rsquo;ll explore on my own
        </button>
      </div>
    </div>
  );
}

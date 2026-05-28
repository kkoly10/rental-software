"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { markWelcomeSeen } from "@/lib/guidance/actions";
import type { MiniTour } from "@/lib/guidance/tour-config";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

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
  const { messages: m } = useI18n();
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = "welcome-modal-title";

  function close() {
    setOpen(false);
    startTransition(() => {
      markWelcomeSeen();
    });
  }

  // Focus the dialog on mount and close on Escape so keyboard/AT users can
  // perceive the dialog opening and dismiss it.
  useEffect(() => {
    if (!open) return;
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleStartTour(tourId: string) {
    close();
    onStartTour(tourId);
  }

  if (!open) return null;

  const greeting = businessName
    ? formatMessage(m.welcomeModal.greetingBusiness, { business: businessName })
    : m.welcomeModal.greetingDefault;

  return (
    <div className="welcome-overlay" onClick={close}>
      <div
        className="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="welcome-header">
          <div className="welcome-icon" aria-hidden="true">&#9889;</div>
          <h2 id={titleId} style={{ margin: "12px 0 6px", fontSize: "1.6rem" }}>
            {greeting}
          </h2>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto" }}>
            {m.welcomeModal.intro}
          </p>
        </div>

        <div className="welcome-tour-picks">
          <div className="kicker" style={{ marginBottom: 10, fontSize: 11 }}>
            {m.welcomeModal.pickFirst}
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
            {m.welcomeModal.helpCenter}
          </a>
          <span className="muted">{m.welcomeModal.or}</span>
          <a href="/dashboard/settings" className="welcome-alt-link" onClick={close}>
            {m.welcomeModal.completeProfile}
          </a>
        </div>

        <button
          className="ghost-btn"
          onClick={close}
          disabled={isPending}
          style={{ marginTop: 12, width: "100%", textAlign: "center" }}
        >
          {m.welcomeModal.skip}
        </button>
      </div>
    </div>
  );
}

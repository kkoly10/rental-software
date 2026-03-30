"use client";

import { useState } from "react";
import { WelcomeModal } from "./welcome-modal";
import { GuidedTourOverlay } from "./guided-tour-overlay";
import type { GuidanceState } from "@/lib/guidance/actions";
import { miniTours } from "@/lib/guidance/tour-config";

export function DashboardGuidance({
  guidanceState,
  businessName,
}: {
  guidanceState: GuidanceState;
  businessName?: string;
}) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const showWelcome = !guidanceState.hasSeenWelcome;

  const activeTour = activeTourId
    ? miniTours.find((t) => t.id === activeTourId) ?? null
    : null;

  return (
    <>
      {showWelcome && (
        <WelcomeModal
          businessName={businessName}
          miniTours={miniTours}
          onStartTour={(tourId) => setActiveTourId(tourId)}
        />
      )}
      {activeTour && (
        <GuidedTourOverlay
          steps={activeTour.steps}
          tourName={activeTour.name}
          onComplete={() => setActiveTourId(null)}
        />
      )}
    </>
  );
}

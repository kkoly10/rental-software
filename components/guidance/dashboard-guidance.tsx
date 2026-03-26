"use client";

import { useState } from "react";
import { WelcomeModal } from "./welcome-modal";
import { GuidedTourOverlay } from "./guided-tour-overlay";
import type { GuidanceState } from "@/lib/guidance/actions";

export function DashboardGuidance({
  guidanceState,
}: {
  guidanceState: GuidanceState;
}) {
  const [tourActive, setTourActive] = useState(false);
  const showWelcome = !guidanceState.hasSeenWelcome;

  return (
    <>
      {showWelcome && (
        <WelcomeModal onStartTour={() => setTourActive(true)} />
      )}
      {tourActive && (
        <GuidedTourOverlay onComplete={() => setTourActive(false)} />
      )}
    </>
  );
}

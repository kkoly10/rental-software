"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { tourSteps } from "@/lib/guidance/tour-config";
import { markTourCompleted } from "@/lib/guidance/actions";

export function GuidedTourOverlay({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [, startTransition] = useTransition();
  const current = tourSteps[step];

  const updatePosition = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(current.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setPosition(null);
    }
  }, [current]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  function finish() {
    startTransition(() => { markTourCompleted(); });
    onComplete();
  }

  function next() {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!current) return null;

  const tooltipStyle: React.CSSProperties = position
    ? getTooltipPosition(position, current.placement)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="tour-overlay">
      {position && (
        <div
          className="tour-highlight"
          style={{
            top: position.top - 4,
            left: position.left - 4,
            width: position.width + 8,
            height: position.height + 8,
          }}
        />
      )}

      <div className="tour-tooltip" style={tooltipStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span className="kicker" style={{ fontSize: 11 }}>
            Step {step + 1} of {tourSteps.length}
          </span>
          <button className="ghost-btn" onClick={finish} style={{ fontSize: 12, padding: "2px 8px" }}>
            Skip tour
          </button>
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>{current.title}</h3>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5 }}>
          {current.description}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {step > 0 && (
            <button className="secondary-btn" onClick={prev} style={{ padding: "8px 14px", fontSize: 13 }}>
              Back
            </button>
          )}
          <button className="primary-btn" onClick={next} style={{ padding: "8px 14px", fontSize: 13 }}>
            {step < tourSteps.length - 1 ? "Next" : "Finish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getTooltipPosition(
  pos: { top: number; left: number; width: number; height: number },
  placement: string
): React.CSSProperties {
  const gap = 12;
  switch (placement) {
    case "bottom":
      return { top: pos.top + pos.height + gap, left: pos.left, maxWidth: 360 };
    case "top":
      return { top: pos.top - gap, left: pos.left, maxWidth: 360, transform: "translateY(-100%)" };
    case "right":
      return { top: pos.top, left: pos.left + pos.width + gap, maxWidth: 340 };
    case "left":
      return { top: pos.top, left: pos.left - gap, maxWidth: 340, transform: "translateX(-100%)" };
    default:
      return { top: pos.top + pos.height + gap, left: pos.left, maxWidth: 360 };
  }
}

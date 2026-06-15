"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TOUR_SEEN_KEY = "korent.builder.tour.v1";

/** Persisted "the operator has finished/skipped the tour at least once" flag. */
export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked → behave as "seen" so we never nag.
  }
}

function markTourSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    /* best-effort */
  }
}

/** A single coach-mark step. `target` is a CSS selector resolved at runtime. */
export type TourStep = {
  title: string;
  body: string;
  /** Selector for the spotlight target; omit for a centered step. */
  target?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const SPOTLIGHT_PAD = 8;
const POPOVER_GAP = 14;

/**
 * First-run guided tour (PR-2d). A dimmed overlay with a "spotlight" cutout
 * around the current step's target plus a popover (Back / Next / Skip, Done on
 * the last step). Controlled via `open` + `onClose`; the runtime decides when to
 * auto-open (first run) or replay (Help → Replay tour). Finishing OR skipping
 * persists the seen flag so it never auto-shows again.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, labelled by the step title.
 * Escape skips; Enter / → = Next; ← = Back. The popover's primary button is
 * focused on each step.
 */
export function EditorTour({
  open,
  steps,
  labels,
  onClose,
}: {
  open: boolean;
  steps: TourStep[];
  labels: { back: string; next: string; skip: string; done: string; stepOf: string };
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = "editor-tour-title";

  const total = steps.length;
  const step = steps[index];
  const isLast = index >= total - 1;

  // Reset to the first step whenever the tour (re)opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const finish = useCallback(() => {
    markTourSeen();
    onClose();
  }, [onClose]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [total, finish]);

  const goBack = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  // Measure the current target (and scroll it into view first). Recompute on
  // resize/scroll. Falls back to a centered popover when no target is found.
  const measure = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    if (step?.target) {
      const el = document.querySelector<HTMLElement>(step.target);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    // Measure after a frame so a smooth scroll has a chance to settle.
    const raf = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(raf);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [open, measure]);

  // Keyboard: Escape skips, Enter/→ next, ← back.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, goNext, goBack]);

  // Focus the primary action on each step.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => primaryBtnRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, index]);

  // Position of the popover relative to the (optional) spotlight.
  const popoverStyle = useMemo<React.CSSProperties>(() => {
    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const below = targetRect.top + targetRect.height + POPOVER_GAP;
    const placeBelow = below < vh - 220;
    const top = placeBelow
      ? targetRect.top + targetRect.height + POPOVER_GAP
      : Math.max(72, targetRect.top - POPOVER_GAP);
    const left = Math.min(
      Math.max(16, targetRect.left + targetRect.width / 2),
      (typeof window !== "undefined" ? window.innerWidth : 1024) - 16
    );
    return {
      top,
      left,
      transform: placeBelow ? "translateX(-50%)" : "translate(-50%, -100%)",
    };
  }, [targetRect]);

  const spotlightStyle = useMemo<React.CSSProperties | null>(() => {
    if (!targetRect) return null;
    return {
      top: targetRect.top - SPOTLIGHT_PAD,
      left: targetRect.left - SPOTLIGHT_PAD,
      width: targetRect.width + SPOTLIGHT_PAD * 2,
      height: targetRect.height + SPOTLIGHT_PAD * 2,
    };
  }, [targetRect]);

  if (!open || !step) return null;

  return (
    <div className="st-tour-root" data-st-editor-chrome>
      {/* Dim layer — clicking it skips the tour (a common, forgiving pattern). */}
      <div className="st-tour-scrim" onClick={finish} />

      {spotlightStyle && (
        <div className="st-tour-spotlight" style={spotlightStyle} aria-hidden="true" />
      )}

      <div
        className="st-tour-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={popoverStyle}
      >
        <p className="st-tour-step-count">
          {labels.stepOf
            .replace("{current}", String(index + 1))
            .replace("{total}", String(total))}
        </p>
        <h2 id={titleId} className="st-tour-title">
          {step.title}
        </h2>
        <p className="st-tour-body">{step.body}</p>
        <div className="st-tour-actions">
          <button type="button" className="st-tour-skip" onClick={finish}>
            {labels.skip}
          </button>
          <div className="st-tour-nav">
            {index > 0 && (
              <button type="button" className="st-tour-back" onClick={goBack}>
                {labels.back}
              </button>
            )}
            <button
              ref={primaryBtnRef}
              type="button"
              className="st-tour-next"
              onClick={goNext}
            >
              {isLast ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

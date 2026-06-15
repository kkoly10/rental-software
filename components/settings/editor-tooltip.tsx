"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";

type Side = "top" | "bottom" | "left" | "right";

/**
 * Accessible editor-chrome tooltip (PR-2d). Wraps a single focusable control and
 * shows a concise hint on BOTH mouseenter and focus (WCAG 1.4.13 / SC 2.1) — and
 * hides on mouseleave, blur, and Escape. The bubble:
 *
 * - carries `role="tooltip"` + a generated id; the child gets `aria-describedby`
 *   pointing to it (injected via `cloneElement`).
 * - is `pointer-events: none` so it never blocks clicks, but the wrapper still
 *   tracks hover so the tip stays visible while the operator reads it (no flicker
 *   moving from the trigger toward the bubble — they overlap the wrapper).
 * - uses a short (~120ms) show delay to avoid noise on quick mouse passes.
 *
 * Intentionally CSS-positioned (no portal): simple + robust, sits above editor
 * chrome via a high z-index. Concise copy only; dark bubble / white text meets
 * contrast.
 */
export function EditorTooltip({
  label,
  side = "bottom",
  children,
}: {
  label: string;
  side?: Side;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const tooltipId = `editor-tooltip-${id.replace(/[:]/g, "")}`;
  const [open, setOpen] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShowTimer = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }, []);

  const scheduleShow = useCallback(() => {
    clearShowTimer();
    showTimer.current = setTimeout(() => setOpen(true), 120);
  }, [clearShowTimer]);

  const hide = useCallback(() => {
    clearShowTimer();
    setOpen(false);
  }, [clearShowTimer]);

  // Show immediately on focus (keyboard users shouldn't wait on the delay).
  const showNow = useCallback(() => {
    clearShowTimer();
    setOpen(true);
  }, [clearShowTimer]);

  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        // Don't swallow Escape from larger handlers — just dismiss the bubble.
        hide();
      }
    },
    [open, hide]
  );

  // Keep the native title off the cloned child if present (avoids a doubled,
  // browser-rendered bubble alongside ours).
  const child =
    isValidElement(children) &&
    cloneElement(children, { "aria-describedby": open ? tooltipId : undefined });

  return (
    <span
      className="st-editor-tip-wrap"
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={(_e: FocusEvent) => showNow()}
      onBlur={(_e: FocusEvent) => hide()}
      onKeyDown={onKeyDown}
    >
      {child}
      <span
        role="tooltip"
        id={tooltipId}
        className={`st-editor-tip st-editor-tip-${side}`}
        data-open={open ? "true" : "false"}
        aria-hidden={open ? undefined : "true"}
      >
        {label}
      </span>
    </span>
  );
}

// Re-export the side type for callers that want to be explicit.
export type EditorTooltipSide = Side;

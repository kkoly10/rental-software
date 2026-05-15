"use client";

import { useI18n } from "@/lib/i18n/provider";

const STATUS_MAP: Record<string, number> = {
  Inquiry: 0,
  "Quote Sent": 0,
  "Awaiting Deposit": 0,
  Confirmed: 1,
  Scheduled: 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Completed: 5,
};

export function OrderTimeline({ currentStatus }: { currentStatus: string }) {
  const { messages: m } = useI18n();
  const STEPS = [
    { key: "inquiry", label: m.orderTimeline.steps.inquiry },
    { key: "confirmed", label: m.orderTimeline.steps.confirmed },
    { key: "scheduled", label: m.orderTimeline.steps.scheduled },
    { key: "delivering", label: m.orderTimeline.steps.delivering },
    { key: "delivered", label: m.orderTimeline.steps.delivered },
    { key: "completed", label: m.orderTimeline.steps.completed },
  ];

  const isCancelled = currentStatus === "Cancelled";
  const currentIndex = STATUS_MAP[currentStatus] ?? -1;

  if (isCancelled) {
    return (
      <div className="portal-timeline" role="progressbar" aria-label={m.orderTimeline.cancelledLabel}>
        <div className="portal-timeline-cancelled">
          <span className="portal-timeline-cancel-icon" aria-hidden="true">&#10007;</span>
          <span>{m.orderTimeline.cancelledMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-timeline" role="progressbar" aria-label={m.orderTimeline.progressLabel}>
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        let className = "portal-timeline-step";
        if (isCompleted) className += " completed";
        else if (isCurrent) className += " current";

        return (
          <div key={step.key} style={{ display: "contents" }}>
            <div className={className}>
              <div className="portal-timeline-dot" aria-hidden="true">
                {isCompleted ? "✓" : ""}
              </div>
              <span className="portal-timeline-label">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`portal-timeline-connector${i < currentIndex ? " completed" : ""}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

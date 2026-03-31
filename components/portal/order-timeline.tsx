"use client";

const STEPS = [
  { key: "inquiry", label: "Inquiry" },
  { key: "confirmed", label: "Confirmed" },
  { key: "scheduled", label: "Scheduled" },
  { key: "delivering", label: "Delivering" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
];

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
  const isCancelled = currentStatus === "Cancelled";
  const currentIndex = STATUS_MAP[currentStatus] ?? -1;

  if (isCancelled) {
    return (
      <div className="portal-timeline" role="progressbar" aria-label="Order cancelled">
        <div className="portal-timeline-cancelled">
          <span className="portal-timeline-cancel-icon" aria-hidden="true">&#10007;</span>
          <span>This order has been cancelled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-timeline" role="progressbar" aria-label="Order progress">
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

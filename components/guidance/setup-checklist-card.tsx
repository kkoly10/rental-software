"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissChecklist } from "@/lib/guidance/actions";

type ChecklistItemData = {
  id: string;
  title: string;
  description: string;
  href: string;
  order: number;
  completed: boolean;
};

const PHASE_1_COUNT = 5;

export function SetupChecklistCard({
  items,
  completed,
  total,
}: {
  items: ChecklistItemData[];
  completed: number;
  total: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  const phase1Items = items.slice(0, PHASE_1_COUNT);
  const phase2Items = items.slice(PHASE_1_COUNT);
  const phase1Completed = phase1Items.filter((i) => i.completed).length;
  const phase1Done = phase1Completed === PHASE_1_COUNT;

  const displayItems = showAll ? items : phase1Items;
  const displayCompleted = showAll ? completed : phase1Completed;
  const displayTotal = showAll ? total : PHASE_1_COUNT;
  const progress = displayTotal > 0 ? Math.round((displayCompleted / displayTotal) * 100) : 0;

  const allDone = completed === total;

  return (
    <div className="checklist-card" data-tour="setup-checklist">
      <div className="checklist-header">
        <div style={{ flex: 1 }}>
          <div className="kicker">Getting started</div>
          <h2 style={{ margin: "6px 0 4px", fontSize: "1.25rem" }}>
            {allDone
              ? "Setup complete!"
              : phase1Done && !showAll
              ? "Phase 1 complete!"
              : "Setup checklist"}
          </h2>
          <div className="muted">
            {displayCompleted} of {displayTotal} completed
            {!showAll && phase2Items.length > 0 && (
              <span> (Phase 1)</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="ghost-btn"
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          {allDone && (
            <button
              className="ghost-btn"
              onClick={() => {
                setDismissed(true);
                startTransition(() => { dismissChecklist(); });
              }}
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      <div className="checklist-progress-bar">
        <div
          className="checklist-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {phase1Done && !showAll && expanded && (
        <div className="checklist-milestone">
          <strong>Nice work!</strong> You&apos;ve completed the essentials. Your
          storefront is ready for your first real booking.
        </div>
      )}

      {expanded && (
        <>
          <div className="checklist-list">
            {displayItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`checklist-item ${item.completed ? "checklist-item-done" : ""}`}
              >
                <div className="checklist-check">
                  {item.completed ? "\u2713" : item.order}
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{item.title}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>{item.description}</div>
                </div>
                {!item.completed && (
                  <span className="checklist-go">Go &rarr;</span>
                )}
              </Link>
            ))}
          </div>

          {!showAll && phase2Items.length > 0 && (
            <button
              className="ghost-btn"
              onClick={() => setShowAll(true)}
              style={{ width: "100%", textAlign: "center", marginTop: 8, fontSize: 13 }}
            >
              Show {phase2Items.length} more steps (advanced)
            </button>
          )}

          {showAll && (
            <button
              className="ghost-btn"
              onClick={() => setShowAll(false)}
              style={{ width: "100%", textAlign: "center", marginTop: 8, fontSize: 13 }}
            >
              Show less
            </button>
          )}
        </>
      )}
    </div>
  );
}

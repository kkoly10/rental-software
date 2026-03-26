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
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total;

  return (
    <div className="checklist-card" data-tour="setup-checklist">
      <div className="checklist-header">
        <div style={{ flex: 1 }}>
          <div className="kicker">Getting started</div>
          <h2 style={{ margin: "6px 0 4px", fontSize: "1.25rem" }}>
            {allDone ? "Setup complete!" : "Setup checklist"}
          </h2>
          <div className="muted">
            {completed} of {total} completed
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

      {expanded && (
        <div className="checklist-list">
          {items.map((item) => (
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
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissChecklist } from "@/lib/guidance/actions";
import { useI18n } from "@/lib/i18n/provider";

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
  const { messages: m, t } = useI18n();
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
          <div className="kicker">{m.setupChecklist.kicker}</div>
          <h2 style={{ margin: "6px 0 4px", fontSize: "1.25rem" }}>
            {allDone
              ? m.setupChecklist.setupComplete
              : phase1Done && !showAll
              ? m.setupChecklist.phase1Complete
              : m.setupChecklist.setupChecklist}
          </h2>
          <div className="muted">
            {t(m.setupChecklist.progressCount, { completed: displayCompleted, total: displayTotal })}
            {!showAll && phase2Items.length > 0 && (
              <span>{m.setupChecklist.phase1Suffix}</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="ghost-btn"
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            {expanded ? m.setupChecklist.collapse : m.setupChecklist.expand}
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
              {m.setupChecklist.dismiss}
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
          <strong>{m.setupChecklist.milestoneTitle}</strong> {m.setupChecklist.milestoneBody}
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
                  <span className="checklist-go">{m.setupChecklist.go}</span>
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
              {t(m.setupChecklist.showMore, { count: phase2Items.length })}
            </button>
          )}

          {showAll && (
            <button
              className="ghost-btn"
              onClick={() => setShowAll(false)}
              style={{ width: "100%", textAlign: "center", marginTop: 8, fontSize: 13 }}
            >
              {m.setupChecklist.showLess}
            </button>
          )}
        </>
      )}
    </div>
  );
}

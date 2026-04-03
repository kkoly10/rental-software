"use client";

import { useState } from "react";

export function SetupProgressBar({
  completed,
  total,
  allDone,
}: {
  completed: number;
  total: number;
  allDone: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (dismissed) return null;

  // Show celebration when all required items are complete
  if (allDone) {
    return (
      <div
        className="panel"
        style={{
          background: "linear-gradient(135deg, #059669, #10b981)",
          color: "#fff",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <strong style={{ fontSize: 16 }}>Setup Complete!</strong>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
            Your rental business is fully configured and ready for customers.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Setup progress</strong>
        <span style={{ fontSize: 13, color: "var(--text-soft)" }}>
          {completed}/{total} steps · {percent}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--surface-muted)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: percent === 100 ? "#059669" : "var(--primary)",
            borderRadius: 999,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

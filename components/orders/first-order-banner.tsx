"use client";

import { useState } from "react";
import Link from "next/link";

export function FirstOrderBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="panel"
      style={{
        marginBottom: 20,
        padding: "20px 24px",
        background: "var(--surface-muted)",
        borderLeft: "4px solid #22c55e",
        position: "relative",
      }}
    >
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute",
          top: 12,
          right: 14,
          background: "none",
          border: "none",
          fontSize: 18,
          color: "var(--text-soft)",
          cursor: "pointer",
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        &times;
      </button>

      <strong style={{ fontSize: 15, color: "#16a34a" }}>
        Your first order is live!
      </strong>
      <div className="muted" style={{ marginTop: 8, lineHeight: 1.8 }}>
        Here&apos;s what to do next:
      </div>
      <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
        <li>
          Record a deposit payment &rarr;{" "}
          <Link href="/dashboard/payments" style={{ fontWeight: 600 }}>
            Go to Payments
          </Link>
        </li>
        <li>
          Generate rental documents &rarr;{" "}
          <Link href="/dashboard/documents" style={{ fontWeight: 600 }}>
            Go to Documents
          </Link>
        </li>
        <li>
          Check delivery planning &rarr;{" "}
          <Link href="/dashboard/deliveries" style={{ fontWeight: 600 }}>
            Go to Deliveries
          </Link>
        </li>
      </ol>
      <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
        These steps help you practice the full booking workflow before real customers arrive.
      </div>
    </div>
  );
}

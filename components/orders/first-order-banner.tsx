"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export function FirstOrderBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { messages: m } = useI18n();

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
        aria-label={m.common.dismiss}
      >
        &times;
      </button>

      <strong style={{ fontSize: 15, color: "#16a34a" }}>
        {m.firstOrderBanner.title}
      </strong>
      <div className="muted" style={{ marginTop: 8, lineHeight: 1.8 }}>
        {m.firstOrderBanner.intro}
      </div>
      <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
        <li>
          {m.firstOrderBanner.recordDeposit} &rarr;{" "}
          <Link href="/dashboard/payments" style={{ fontWeight: 600 }}>
            {m.firstOrderBanner.goToPayments}
          </Link>
        </li>
        <li>
          {m.firstOrderBanner.generateDocuments} &rarr;{" "}
          <Link href="/dashboard/documents" style={{ fontWeight: 600 }}>
            {m.firstOrderBanner.goToDocuments}
          </Link>
        </li>
        <li>
          {m.firstOrderBanner.checkDelivery} &rarr;{" "}
          <Link href="/dashboard/deliveries" style={{ fontWeight: 600 }}>
            {m.firstOrderBanner.goToDeliveries}
          </Link>
        </li>
      </ol>
      <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
        {m.firstOrderBanner.practiceNote}
      </div>
    </div>
  );
}

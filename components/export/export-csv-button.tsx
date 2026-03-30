"use client";

import { useState, useTransition } from "react";
import type { ExportResult } from "@/lib/export/csv";

type Props = {
  exportAction: () => Promise<ExportResult>;
  label: string;
};

export function ExportCsvButton({ exportAction, label }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleExport() {
    startTransition(async () => {
      setMessage("");
      const result = await exportAction();

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      if (result.csv && result.filename) {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        setMessage(result.message);
      }
    });
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="ghost-btn"
        style={{ fontSize: 13 }}
      >
        {isPending ? "Exporting…" : label}
      </button>
      {message && (
        <span className="muted" style={{ fontSize: 12 }}>
          {message}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backfillPickupStops } from "@/lib/routes/backfill-pickup-stops";

/**
 * One-shot button to back-fill pickup stops on in-flight multi-day rentals
 * after decision 2.6 ships. Owner/admin only (the action enforces). Hidden
 * after a successful run so dispatchers don't accidentally re-run it; a
 * page refresh brings it back if needed.
 */
export function BackfillPickupButton({ label, confirm, runningLabel }: {
  label: string;
  confirm: string;
  runningLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();

  function handleClick() {
    if (!window.confirm(confirm)) return;
    startTransition(async () => {
      const r = await backfillPickupStops();
      setResult({ ok: r.ok, message: r.message });
      if (r.ok) router.refresh();
    });
  }

  if (result?.ok) {
    return (
      <span className="badge success" style={{ fontSize: 12 }}>
        {result.message}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <button
        type="button"
        className="ghost-btn"
        onClick={handleClick}
        disabled={pending}
        style={{ fontSize: 12 }}
      >
        {pending ? runningLabel : label}
      </button>
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }} role="alert">
          {result.message}
        </span>
      )}
    </div>
  );
}

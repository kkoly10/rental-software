"use client";

import { useState, useTransition } from "react";
import { archiveServiceArea } from "@/lib/service-areas/actions";

export function ServiceAreaArchiveButton({ serviceAreaId }: { serviceAreaId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        className="ghost-btn"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            "Remove this service area from active checkout coverage?"
          );
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            const result = await archiveServiceArea(serviceAreaId);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--danger, #e53e3e)" }}>
          {error}
        </span>
      )}
    </span>
  );
}

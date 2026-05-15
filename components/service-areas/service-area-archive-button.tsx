"use client";

import { useState, useTransition } from "react";
import { archiveServiceArea } from "@/lib/service-areas/actions";
import { useI18n } from "@/lib/i18n/provider";

export function ServiceAreaArchiveButton({ serviceAreaId }: { serviceAreaId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { messages: m } = useI18n();

  return (
    <span>
      <button
        type="button"
        className="ghost-btn"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            m.forms.serviceAreaArchive.removeConfirm
          );
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            const result = await archiveServiceArea(serviceAreaId);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {pending ? m.forms.serviceAreaArchive.removing : m.common.remove}
      </button>
      {error && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--danger, #e53e3e)" }}>
          {error}
        </span>
      )}
    </span>
  );
}

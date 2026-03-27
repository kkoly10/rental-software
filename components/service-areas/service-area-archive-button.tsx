"use client";

import { useTransition } from "react";
import { archiveServiceArea } from "@/lib/service-areas/actions";

export function ServiceAreaArchiveButton({ serviceAreaId }: { serviceAreaId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="ghost-btn"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "Remove this service area from active checkout coverage?"
        );

        if (!confirmed) {
          return;
        }

        startTransition(async () => {
          await archiveServiceArea(serviceAreaId);
        });
      }}
    >
      {pending ? "Saving..." : "Remove"}
    </button>
  );
}

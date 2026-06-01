"use client";

import { useEffect, useState } from "react";
import { formatMessage } from "@/lib/i18n/format";

type GreetingSlot = "morning" | "afternoon" | "evening";

function pickGreetingKey(): GreetingSlot {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/**
 * Client component that resolves the time-of-day slot using the
 * operator's local clock rather than the server's UTC clock.  The
 * initial render still uses the server-picked "afternoon" template
 * so SSR markup matches the first paint; on mount we recompute and
 * swap only if the browser's slot differs.
 */
export function DashboardGreetingHeadline({
  name,
  templates,
}: {
  name: string;
  templates: Record<GreetingSlot, string>;
}) {
  const [slot, setSlot] = useState<GreetingSlot>("afternoon");

  useEffect(() => {
    setSlot(pickGreetingKey());
  }, []);

  return (
    <h1 className="dashboard-greeting-headline">
      {formatMessage(templates[slot], { name })}
    </h1>
  );
}

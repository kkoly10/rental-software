"use client";

import { useEffect, useState, type ReactNode } from "react";
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
 *
 * When `accentWords` is supplied, the time-of-day word for the active
 * slot is wrapped in an italic serif span (the mockup's "Good
 * *evening*" treatment). Falls back to the plain string if the accent
 * word isn't found in the resolved greeting (e.g. a locale mismatch).
 */
export function DashboardGreetingHeadline({
  name,
  templates,
  accentWords,
}: {
  name: string;
  templates: Record<GreetingSlot, string>;
  accentWords?: Record<GreetingSlot, string>;
}) {
  const [slot, setSlot] = useState<GreetingSlot>("afternoon");

  useEffect(() => {
    setSlot(pickGreetingKey());
  }, []);

  const full = formatMessage(templates[slot], { name });
  const accent = accentWords?.[slot];

  let content: ReactNode = full;
  if (accent) {
    const idx = full.indexOf(accent);
    if (idx >= 0) {
      content = (
        <>
          {full.slice(0, idx)}
          <span className="u-serif">{full.slice(idx, idx + accent.length)}</span>
          {full.slice(idx + accent.length)}
        </>
      );
    }
  }

  return <h1 className="dashboard-greeting-headline">{content}</h1>;
}

import type { ReactElement } from "react";

/**
 * Sidebar nav glyphs (Patch 4 — icon sidebar).  Stroke icons matched to the
 * Korent v2 dashboard mockup: a leading 18px line icon per nav item, keyed by
 * the nav item's `key`.  Paths are 24×24, stroke `currentColor` so they inherit
 * the link colour (muted when idle, primary when the row is active).
 */

const PATHS: Record<string, string[]> = {
  dashboard: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M13 13h7v7h-7z", "M4 13h7v7H4z"],
  orders: ["M21 8l-9-5-9 5 9 5 9-5z", "M3 8v8l9 5 9-5V8", "M12 13v8"],
  calendar: ["M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M4 9h16", "M8 3v4", "M16 3v4"],
  deliveries: [
    "M3 6a1 1 0 0 1 1-1h10v10H3z",
    "M14 8h4l3 3v3h-7z",
    "M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M18 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  ],
  products: ["M6 7h12l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7z", "M9 7a3 3 0 0 1 6 0"],
  pricing: ["M3 3h7l11 11-7 7L3 10z", "M7.5 7.5h.01"],
  serviceAreas: [
    "M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z",
    "M12 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  ],
  maintenance: ["M14.5 6a3.5 3.5 0 0 0-4.6 4.4L3 17.3 6.7 21l6.9-6.9A3.5 3.5 0 0 0 18 9.5l-2.3 2.3-1.8-1.8L16.2 7.7 14.5 6z"],
  customers: [
    "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 9m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
    "M22 19v-2a4 4 0 0 0-3-3.9",
    "M16 5a4 4 0 0 1 0 7.7",
  ],
  payments: ["M12 2v20", "M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 6.8s2 2.7 5 3.2 5 1.2 5 3.2-2.2 3.3-5 3.3-5-1.1-5-3"],
  analytics: ["M4 20V10", "M10 20V4", "M16 20v-6", "M22 20H2"],
  messages: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  documents: ["M14 3v4a1 1 0 0 0 1 1h4", "M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9 13h6", "M9 17h5"],
  settings: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  website: [
    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    "M3 12h18",
    "M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z",
  ],
  helpCenter: [
    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3",
    "M12 17h.01",
  ],
  billing: ["M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18"],
  team: [
    "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 9m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
    "M19 8v6",
    "M22 11h-6",
  ],
  crewMobile: ["M7 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z", "M11 18h2"],
};

export function NavIcon({ name }: { name: string }): ReactElement | null {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

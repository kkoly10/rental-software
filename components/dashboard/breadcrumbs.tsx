"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  products: "Products",
  payments: "Payments",
  deliveries: "Deliveries",
  customers: "Customers",
  documents: "Documents",
  settings: "Settings",
  new: "New",
  edit: "Edit",
  help: "Help",
  crew: "Crew",
};

function formatSegment(segment: string): string {
  if (segmentLabels[segment]) return segmentLabels[segment];
  // If it looks like an ID (contains digits or dashes typical of UUIDs), show truncated
  if (/^[a-f0-9-]{8,}$/i.test(segment)) {
    return segment.slice(0, 8) + "\u2026";
  }
  // Capitalize hyphenated words as fallback
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = formatSegment(segment);
    const isLast = index === segments.length - 1;

    return { href, label, isLast };
  });

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="breadcrumbs-item">
            {index > 0 && (
              <svg
                className="breadcrumbs-chevron"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {crumb.isLast ? (
              <span className="breadcrumbs-current" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="breadcrumbs-link">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

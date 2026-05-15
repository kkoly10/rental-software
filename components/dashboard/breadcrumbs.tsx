"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n/dictionaries";

function segmentLabel(segment: string, m: Messages): string | undefined {
  const map: Record<string, string> = {
    dashboard: m.dashboard.nav.dashboard,
    orders: m.dashboard.nav.orders,
    products: m.dashboard.nav.products,
    payments: m.dashboard.nav.payments,
    deliveries: m.dashboard.nav.deliveries,
    customers: m.dashboard.nav.customers,
    documents: m.dashboard.nav.documents,
    settings: m.dashboard.nav.settings,
    help: m.dashboard.nav.helpCenter,
    crew: m.dashboard.nav.crewMobile,
    new: m.common.addNew,
    edit: m.common.edit,
  };
  return map[segment];
}

function formatSegment(segment: string, m: Messages): string {
  const labeled = segmentLabel(segment, m);
  if (labeled) return labeled;
  // If it looks like an ID (contains digits or dashes typical of UUIDs), show truncated
  if (/^[a-f0-9-]{8,}$/i.test(segment)) {
    return segment.slice(0, 8) + "…";
  }
  // Capitalize hyphenated words as fallback
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const { messages: m } = useI18n();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = formatSegment(segment, m);
    const isLast = index === segments.length - 1;

    return { href, label, isLast };
  });

  return (
    <nav className="breadcrumbs" aria-label={m.dashboard.nav.dashboard}>
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

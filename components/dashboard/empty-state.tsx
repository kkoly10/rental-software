import Link from "next/link";
import type { ReactNode } from "react";

type IconKey = "orders" | "products" | "payments" | "deliveries" | "customers" | "documents";

const illustrations: Record<IconKey, ReactNode> = {
  orders: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="50" fill="#edf4ff" />
      <rect x="38" y="32" width="44" height="56" rx="6" fill="#d0e0f7" />
      <rect x="46" y="44" width="28" height="4" rx="2" fill="#1e5dcf" opacity="0.6" />
      <rect x="46" y="54" width="20" height="4" rx="2" fill="#1e5dcf" opacity="0.4" />
      <rect x="46" y="64" width="24" height="4" rx="2" fill="#1e5dcf" opacity="0.3" />
      <circle cx="42" cy="46" r="2" fill="#1e5dcf" />
      <circle cx="42" cy="56" r="2" fill="#1e5dcf" opacity="0.6" />
      <circle cx="42" cy="66" r="2" fill="#1e5dcf" opacity="0.4" />
    </svg>
  ),
  products: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="50" fill="#edf4ff" />
      <rect x="30" y="42" width="36" height="36" rx="8" fill="#d0e0f7" />
      <rect x="54" y="42" width="36" height="36" rx="8" fill="#1e5dcf" opacity="0.2" />
      <circle cx="48" cy="60" r="8" fill="#1e5dcf" opacity="0.5" />
      <line x1="72" y1="54" x2="72" y2="66" stroke="#1e5dcf" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <line x1="66" y1="60" x2="78" y2="60" stroke="#1e5dcf" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  payments: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="50" fill="#edf4ff" />
      <rect x="30" y="40" width="60" height="40" rx="8" fill="#d0e0f7" />
      <rect x="30" y="48" width="60" height="8" fill="#1e5dcf" opacity="0.25" />
      <circle cx="74" cy="68" r="6" fill="#1e5dcf" opacity="0.5" />
      <circle cx="64" cy="68" r="6" fill="#1e5dcf" opacity="0.3" />
    </svg>
  ),
  deliveries: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="50" fill="#edf4ff" />
      <rect x="26" y="46" width="46" height="30" rx="6" fill="#d0e0f7" />
      <path d="M72 52h14l8 12v12H72V52z" fill="#1e5dcf" opacity="0.3" />
      <circle cx="46" cy="78" r="6" fill="#1e5dcf" opacity="0.6" />
      <circle cx="82" cy="78" r="6" fill="#1e5dcf" opacity="0.6" />
      <rect x="34" y="54" width="18" height="4" rx="2" fill="#1e5dcf" opacity="0.4" />
    </svg>
  ),
  customers: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="50" fill="#edf4ff" />
      <circle cx="60" cy="48" r="12" fill="#d0e0f7" />
      <ellipse cx="60" cy="78" rx="22" ry="12" fill="#1e5dcf" opacity="0.25" />
      <circle cx="38" cy="54" r="8" fill="#d0e0f7" opacity="0.7" />
      <circle cx="82" cy="54" r="8" fill="#d0e0f7" opacity="0.7" />
    </svg>
  ),
  documents: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="50" fill="#edf4ff" />
      <rect x="40" y="28" width="40" height="52" rx="6" fill="#d0e0f7" />
      <path d="M64 28v14h16" fill="none" stroke="#1e5dcf" strokeWidth="2" opacity="0.4" />
      <rect x="48" y="50" width="24" height="4" rx="2" fill="#1e5dcf" opacity="0.5" />
      <rect x="48" y="60" width="18" height="4" rx="2" fill="#1e5dcf" opacity="0.35" />
      <rect x="48" y="70" width="22" height="4" rx="2" fill="#1e5dcf" opacity="0.25" />
    </svg>
  ),
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: IconKey;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-illustration">
        {illustrations[icon]}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="primary-btn">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

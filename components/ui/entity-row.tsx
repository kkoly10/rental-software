import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * EntityRow — the single crafted list primitive for orders, products,
 * payments, and customers. Replaces the shared flat `.order-card`.
 *
 *   leading   left visual (DateChip / AvatarChip / IconChip / thumbnail)
 *   title     primary line (bold)
 *   meta      secondary line(s) — string or node
 *   trailing  right-aligned nodes (pills, figures) — rendered as flex
 *             siblings so the row `gap` spaces them automatically
 *   accent    status color for the left edge (omit for no edge)
 *   href      makes the whole row a link
 */
export function EntityRow({
  href,
  accent,
  leading,
  title,
  meta,
  trailing,
}: {
  href?: string;
  accent?: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  const row = (
    <article
      className={`entity-row${accent ? " has-accent" : ""}`}
      style={accent ? ({ "--row-accent": accent } as CSSProperties) : undefined}
    >
      {leading}
      <div className="entity-row__grow">
        <div className="entity-row__title">{title}</div>
        {meta && <div className="entity-row__meta">{meta}</div>}
      </div>
      {trailing}
    </article>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {row}
    </Link>
  ) : (
    row
  );
}

/** tone → CSS color, shared with StatusBadge tones. */
export const toneColor: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  accent: "var(--accent)",
  default: "var(--text-muted)",
};

/** Stacked month/day chip from an ISO date (YYYY-MM-DD). */
export function DateChip({ iso, locale = "en-US" }: { iso?: string; locale?: string }) {
  if (!iso) {
    return (
      <span className="icon-chip" style={{ background: "var(--bg-alt)", color: "var(--text-muted)", fontWeight: 700 }}>
        —
      </span>
    );
  }
  const d = new Date(iso + "T12:00:00Z");
  const m = d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" }).toUpperCase();
  const day = d.toLocaleDateString(locale, { day: "numeric", timeZone: "UTC" });
  return (
    <div className="date-chip">
      <div className="date-chip__m">{m}</div>
      <div className="date-chip__d">{day}</div>
    </div>
  );
}

/** Initials avatar in a tinted circle. */
export function AvatarChip({ name, color = "var(--primary)" }: { name: string; color?: string }) {
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      className="avatar-chip"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      {initials}
    </span>
  );
}

/** Icon in a tinted square chip. */
export function IconChip({ children, color = "var(--primary)" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="icon-chip"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

/** Right-aligned headline figure (money / counts). */
export function RowFigure({ children }: { children: ReactNode }) {
  return <strong className="entity-row__figure" style={{ textAlign: "right" }}>{children}</strong>;
}

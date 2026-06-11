import type { Metadata } from "next";
import Link from "next/link";
import "./market.css";
import { metroBySlug, DEFAULT_METRO_SLUG } from "@/lib/market/registry";

export const metadata: Metadata = {
  title: {
    default: "Korent Marketplace — rent expensive things near you",
    template: "%s · Korent Marketplace",
  },
  description:
    "Rent tents, event gear, tools, cameras and more from verified local sellers. Deposit-protected with photo evidence on every rental.",
};

/**
 * Marketplace chrome. Deliberately does NOT reuse the operator
 * storefront header/footer components — those resolve tenant org
 * settings and belong to the operator surface (build plan Rule 1).
 */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  const metro = metroBySlug.get(DEFAULT_METRO_SLUG);
  return (
    <div className="mk-root">
      <nav className="mk-topnav">
        <Link href="/market" className="mk-logo">
          korent<em>.</em>
          <small>marketplace</small>
        </Link>
        <form className="mk-search" action="/market/search" method="get">
          <input
            type="search"
            name="q"
            placeholder="Search rentals — “20x30 tent”, “chiavari chairs”, “projector”…"
            maxLength={200}
            aria-label="Search marketplace rentals"
          />
          <button type="submit">Search</button>
        </form>
        <span className="mk-metro">
          📍 <b>{metro?.label ?? "Your metro"}</b>
        </span>
        <Link href="/market/rentals" className="mk-metro" style={{ textDecoration: "none" }}>
          My rentals
        </Link>
      </nav>
      {children}
      <footer className="mk-footer">
        <span>© {new Date().getFullYear()} Korent Marketplace</span>
        <span>
          Run a rental business? <a href="/">korent.app</a> is the software side.
        </span>
      </footer>
    </div>
  );
}

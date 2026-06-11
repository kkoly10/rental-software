import type { Metadata } from "next";
import Link from "next/link";
import "./market.css";
import { metroBySlug, DEFAULT_METRO_SLUG } from "@/lib/market/registry";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const metro = metroBySlug.get(DEFAULT_METRO_SLUG);
  let signedIn = false;
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      signedIn = Boolean(user);
    } catch {
      // header degrades to signed-out links
    }
  }
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
        <Link href="/market/messages" className="mk-metro" style={{ textDecoration: "none" }}>
          Messages
        </Link>
        {signedIn ? null : (
          <>
            <Link href="/market/login" className="mk-metro" style={{ textDecoration: "none" }}>
              <b>Sign in</b>
            </Link>
            <Link href="/market/join" className="mk-btn" style={{ padding: "8px 16px", fontSize: 13 }}>
              Join
            </Link>
          </>
        )}
      </nav>
      {children}
      <footer className="mk-footer">
        <span>© {new Date().getFullYear()} Korent Marketplace</span>
        <span style={{ display: "flex", gap: 14 }}>
          <Link href="/market/support">Support</Link>
          <Link href="/market/sell">Become a seller</Link>
          <a href="/">korent.app — the software side</a>
        </span>
      </footer>
    </div>
  );
}

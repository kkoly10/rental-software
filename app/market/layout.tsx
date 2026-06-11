import type { Metadata } from "next";
import Link from "next/link";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./market.css";
import { metroBySlug, DEFAULT_METRO_SLUG } from "@/lib/market/registry";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sora = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--mk-font-display" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--mk-font-body" });

export const metadata: Metadata = {
  title: {
    default: "Korent Marketplace — rent expensive things near you",
    template: "%s · Korent Marketplace",
  },
  description:
    "Rent tents, event gear, tools, cameras and more from verified local sellers. Deposit-protected with photo evidence on every rental.",
};

/**
 * Marketplace chrome (M4 mockup): pill search nav with signed-in
 * avatar state, dark 4-column footer. Deliberately does NOT reuse the
 * operator storefront header/footer components — those resolve tenant
 * org settings and belong to the operator surface (build plan Rule 1).
 */
export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const metro = metroBySlug.get(DEFAULT_METRO_SLUG);
  let signedIn = false;
  let initial = "";
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      signedIn = Boolean(user);
      const name =
        (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
      initial = name.trim().charAt(0).toUpperCase();
    } catch {
      // header degrades to signed-out links
    }
  }
  return (
    <div className={`mk-root ${sora.variable} ${jakarta.variable}`}>
      <nav className="mk-topnav">
        <Link href="/market" className="mk-logo">
          korent<em>.</em>
          <small>marketplace</small>
        </Link>
        <form className="mk-search" action="/market/search" method="get">
          <input
            type="search"
            name="q"
            placeholder="Search rentals…"
            maxLength={200}
            aria-label="Search marketplace rentals"
          />
          <button type="submit">Search</button>
        </form>
        <span className="mk-metro">
          📍 <b>{metro?.label ?? "Your metro"}</b>
        </span>
        <div className="mk-navlinks">
          {signedIn ? (
            <>
              <Link href="/market/rentals" className="mk-navlink">
                My rentals
              </Link>
              <Link href="/market/messages" className="mk-navlink">
                Messages
              </Link>
              <Link href="/market/rentals" className="mk-avatar" aria-label="Your account">
                {initial || "•"}
              </Link>
            </>
          ) : (
            <>
              <Link href="/market/sell" className="mk-navlink">
                Become a seller
              </Link>
              <Link href="/market/login" className="mk-navlink strong">
                Sign in
              </Link>
              <Link href="/market/join" className="mk-btn mk-join">
                Join free
              </Link>
            </>
          )}
        </div>
      </nav>
      {children}
      <footer className="mk-footer">
        <div className="mk-footer-grid">
          <div>
            <div className="mk-logo dark">
              korent<em>.</em>
              <small>marketplace</small>
            </div>
            <p>
              Rent expensive things from verified local sellers —
              deposit-protected, with photo evidence on every rental.
            </p>
          </div>
          <div>
            <b>Browse</b>
            <Link href="/market/world/hosting-and-events">Hosting &amp; Events</Link>
            <Link href="/market">All worlds</Link>
            <Link href="/market/search">Search</Link>
            <span>📍 {metro?.label ?? "Washington–DMV"}</span>
          </div>
          <div>
            <b>Trust</b>
            <Link href="/market#how-it-works">How deposits work</Link>
            <Link href="/market#how-it-works">Photo evidence</Link>
            <Link href="/market/support">Cancellation policy</Link>
            <Link href="/market/support">Disputes</Link>
          </div>
          <div>
            <b>Sell</b>
            <Link href="/market/sell">Become a seller</Link>
            <Link href="/dashboard/marketplace">Seller hub</Link>
            <a href="/pricing">Operator plans</a>
            <Link href="/market/support">Support</Link>
          </div>
        </div>
        <div className="mk-footer-bar">
          <span>© {new Date().getFullYear()} Korent Marketplace</span>
          <a href="/">korent.app — the software side</a>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { SellerSignupForm } from "@/components/market/seller-signup-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Become a seller" };

export default async function MarketSellPage() {
  let signedIn = false;
  let hasOrg = false;
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
    if (user) hasOrg = Boolean(await getOrgContext());
  }

  return (
    <main className="mk-wrap" style={{ maxWidth: 560 }}>
      <h1>Rent out your gear</h1>
      <p className="mk-sub">
        List free. You pay a <b>15% fee only when you get booked</b> — deposits,
        evidence and disputes are handled for you. Run a full rental business?
        Korent operators on the software plan pay just 8%:{" "}
        <a href="/signup">operator signup</a>.
      </p>

      <div className="mk-panel">
        {hasOrg ? (
          <>
            <b>You already have a seller account.</b>
            <p className="mk-sub" style={{ margin: "8px 0 12px" }}>
              Manage your store page and listings from the Seller Hub.
            </p>
            <a className="mk-btn" href="/market/hub">
              Open Seller Hub →
            </a>
          </>
        ) : signedIn ? (
          <SellerSignupForm />
        ) : (
          <>
            <b>First, create an account (or sign in).</b>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <Link className="mk-btn" href="/market/join">
                Create account
              </Link>
              <a
                className="mk-btn ghost"
                href={`/market/login?redirect=${encodeURIComponent("/market/sell")}`}
              >
                Sign in
              </a>
            </div>
          </>
        )}
      </div>

      <p className="mk-note" style={{ marginTop: 14 }}>
        Before anything is bookable you'll connect payouts (Stripe identity +
        bank verification) — that's the §22 rule that keeps every seller on the
        marketplace verified.
      </p>
    </main>
  );
}

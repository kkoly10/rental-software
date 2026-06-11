import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { SellerHubPanels } from "@/components/market/seller-hub-panels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seller Hub" };

/**
 * Seller Hub — marketplace-branded door (Amazon's Seller Central
 * model): marketplace sellers manage their store where they signed
 * up, in marketplace chrome, without the operator dashboard. Renders
 * the same SellerHubPanels as /dashboard/marketplace.
 */
export default async function MarketSellerHubPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mk-wrap">
        <h1>Seller Hub</h1>
        <p className="mk-sub">Unavailable in this environment.</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/market/login?redirect=${encodeURIComponent("/market/hub")}`);
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    redirect("/market/sell");
  }

  const { data: profile } = await supabase
    .from("market_seller_profiles")
    .select("slug, display_name")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  return (
    <main className="mk-wrap mk-hub">
      <div className="mk-rowhead" style={{ marginBottom: 14 }}>
        <div>
          <div className="mk-crumb" style={{ marginBottom: 4 }}>
            <Link href="/market">Marketplace</Link> · <b>Seller Hub</b>
          </div>
          <h1 style={{ margin: 0 }}>
            {profile?.display_name ?? "Your Seller Hub"}
          </h1>
          <p className="mk-sub" style={{ margin: "6px 0 0" }}>
            Requests, bookings, listings and your store page — all in one
            place. Free to list; fees apply only when you get booked.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {profile?.slug ? (
            <Link href={`/market/store/${profile.slug}`} className="mk-btn ghost">
              View store page →
            </Link>
          ) : null}
          <Link href="/market" className="mk-navlink" style={{ alignSelf: "center" }}>
            Switch to renting
          </Link>
        </div>
      </div>

      <SellerHubPanels />

      <p className="mk-note" style={{ marginTop: 18 }}>
        Want the full operator toolkit — your own storefront website,
        delivery routing, CRM and invoicing?{" "}
        <Link href="/dashboard/unlock">Unlock it free</Link> — your
        marketplace store comes with it.
      </p>
    </main>
  );
}

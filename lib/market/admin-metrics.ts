import "server-only";

/**
 * Founder ops metrics for /dashboard/market-admin (admin-client reads,
 * page is PLATFORM_ADMIN_EMAILS-gated). The marketplace canon: GMV and
 * take tell you size, dispute rate tells you trust, liquidity signals
 * (demand events vs supply) tell you where the funnel leaks.
 */

const PAID_STATES = [
  "confirmed",
  "ready_for_handoff",
  "checked_out",
  "overdue",
  "returned_pending_review",
  "completed",
];

export type MarketplaceOpsMetrics = {
  gmv30dCents: number;
  platformRevenue30dCents: number;
  bookingsByState: Record<string, number>;
  completedAllTime: number;
  disputesAllTime: number;
  /** Disputes per 100 completed rentals (all-time). */
  disputeRatePct: number | null;
  openDisputes: number;
  oldestOpenDisputeDays: number | null;
  publishedListings: number;
  sellers: number;
  searches30d: number;
  waitlistJoins30d: number;
  standbyWaiting: number;
  depositFailures: number;
};

export type SaasOpsMetrics = {
  totalOrgs: number;
  marketplaceSellerOrgs: number;
  newOrgs30d: number;
  errors24h: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

async function count(admin: AdminClient, table: string, build: (q: AdminClient) => AdminClient): Promise<number> {
  const { count: n } = await build(
    admin.from(table).select("id", { count: "exact", head: true }),
  );
  return n ?? 0;
}

export async function getMarketplaceOpsMetrics(
  admin: AdminClient,
): Promise<MarketplaceOpsMetrics> {
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [paidRows, stateRows, completedAllTime, disputesAllTime, openDisputeRows, publishedListings, sellers, searches30d, waitlistJoins30d, standbyWaiting, depositFailures] =
    await Promise.all([
      admin
        .from("market_bookings")
        .select("subtotal_cents, tax_cents, platform_fee_cents")
        .in("state", PAID_STATES)
        .gte("created_at", since30d)
        .limit(5000)
        .then((r: { data: { subtotal_cents: number; tax_cents: number | null; platform_fee_cents: number }[] | null }) => r.data ?? []),
      admin
        .from("market_bookings")
        .select("state")
        .limit(5000)
        .then((r: { data: { state: string }[] | null }) => r.data ?? []),
      count(admin, "market_bookings", (q) => q.eq("state", "completed")),
      count(admin, "market_disputes", (q) => q),
      admin
        .from("market_disputes")
        .select("created_at")
        .in("status", ["open", "awaiting_renter_evidence", "awaiting_seller_evidence", "admin_review"])
        .order("created_at", { ascending: true })
        .limit(200)
        .then((r: { data: { created_at: string }[] | null }) => r.data ?? []),
      count(admin, "market_listings", (q) => q.eq("status", "published")),
      count(admin, "market_seller_profiles", (q) => q),
      count(admin, "market_demand_events", (q) => q.eq("kind", "search").gte("created_at", since30d)),
      count(admin, "market_world_waitlist", (q) => q.gte("created_at", since30d)),
      count(admin, "market_reservation_standby", (q) => q.is("promoted_at", null)),
      count(admin, "market_bookings", (q) => q.eq("deposit_status", "failed")),
    ]);

  const bookingsByState: Record<string, number> = {};
  for (const b of stateRows) {
    bookingsByState[b.state] = (bookingsByState[b.state] ?? 0) + 1;
  }

  const gmv30dCents = paidRows.reduce(
    (s: number, b: { subtotal_cents: number; tax_cents: number | null }) =>
      s + b.subtotal_cents + (b.tax_cents ?? 0),
    0,
  );
  const platformRevenue30dCents = paidRows.reduce(
    (s: number, b: { platform_fee_cents: number }) => s + b.platform_fee_cents,
    0,
  );

  const oldestOpenDisputeDays =
    openDisputeRows.length > 0
      ? Math.floor((Date.now() - new Date(openDisputeRows[0].created_at).getTime()) / 86_400_000)
      : null;

  return {
    gmv30dCents,
    platformRevenue30dCents,
    bookingsByState,
    completedAllTime,
    disputesAllTime,
    disputeRatePct:
      completedAllTime > 0
        ? Math.round((disputesAllTime / completedAllTime) * 1000) / 10
        : null,
    openDisputes: openDisputeRows.length,
    oldestOpenDisputeDays,
    publishedListings,
    sellers,
    searches30d,
    waitlistJoins30d,
    standbyWaiting,
    depositFailures,
  };
}

export async function getSaasOpsMetrics(admin: AdminClient): Promise<SaasOpsMetrics> {
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const [totalOrgs, marketplaceSellerOrgs, newOrgs30d, errors24h] = await Promise.all([
    count(admin, "organizations", (q) => q),
    count(admin, "organizations", (q) => q.eq("business_type", "marketplace_seller")),
    count(admin, "organizations", (q) => q.gte("created_at", since30d)),
    count(admin, "app_error_logs", (q) => q.gte("created_at", since24h)),
  ]);
  return { totalOrgs, marketplaceSellerOrgs, newOrgs30d, errors24h };
}

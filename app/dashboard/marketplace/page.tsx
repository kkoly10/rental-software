import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { worlds, listWorldCategories } from "@/lib/market/registry";
import {
  CreateListingForm,
  SellerProfileForm,
} from "@/components/market/seller-hub-forms";
import { publishListing, pauseListing } from "@/lib/market/seller-actions";
import {
  approveBookingRequest,
  declineBookingRequest,
} from "@/lib/market/booking-actions";
import { advanceBooking, confirmRenterIdentity } from "@/lib/market/lifecycle-actions";
import { EvidenceForm } from "@/components/market/evidence-form";
import { FollowupForm } from "@/components/market/followup-form";
import {
  RenterNoShowButton,
  SellerCancelButton,
} from "@/components/market/cancel-buttons";

export const dynamic = "force-dynamic";

type ProfileRow = {
  slug: string;
  display_name: string;
  bio: string | null;
  service_radius_miles: number;
  state_code: string;
  offers_delivery: boolean;
  offers_pickup: boolean;
};

type ListingRow = {
  id: string;
  title: string;
  world_slug: string;
  category_slug: string;
  status: string;
  is_prelist: boolean;
  daily_price_cents: number;
  deposit_cents: number;
};

type RequestRow = {
  id: string;
  state: string;
  starts_at: string;
  ends_at: string;
  quantity: number;
  subtotal_cents: number;
  seller_payout_cents: number;
  renter_message: string | null;
  renter_profile_id: string;
  identity_verified_at: string | null;
  created_at: string;
  market_listings: { title: string } | null;
};

/**
 * Seller Hub v1 (spec §32): store page + listings manager. Lives in
 * the operator dashboard because Korent operators are the launch
 * supply (build plan M1); marketplace-only seller signup comes later.
 */
export default async function MarketplaceSellerHubPage() {
  const ctx = hasSupabaseEnv() ? await getOrgContext() : null;

  let profile: ProfileRow | null = null;
  let listings: ListingRow[] = [];
  let products: Array<{ id: string; name: string }> = [];
  let requests: RequestRow[] = [];
  let sellerFollowedUp = new Set<string>();

  if (ctx) {
    const supabase = await createSupabaseServerClient();
    const requestsPromise = supabase
      .from("market_bookings")
      .select(
        "id, state, starts_at, ends_at, quantity, subtotal_cents, seller_payout_cents, renter_message, renter_profile_id, identity_verified_at, created_at, market_listings ( title )",
      )
      .eq("organization_id", ctx.organizationId)
      .in("state", [
        "pending_seller_approval",
        "awaiting_payment",
        "confirmed",
        "ready_for_handoff",
        "checked_out",
        "overdue",
        "returned_pending_review",
        "completed",
      ])
      .order("created_at", { ascending: false })
      .limit(50);
    const [profileRes, listingsRes, productsRes] = await Promise.all([
      supabase
        .from("market_seller_profiles")
        .select("slug, display_name, bio, service_radius_miles, state_code, offers_delivery, offers_pickup")
        .eq("organization_id", ctx.organizationId)
        .maybeSingle(),
      supabase
        .from("market_listings")
        .select("id, title, world_slug, category_slug, status, is_prelist, daily_price_cents, deposit_cents")
        .eq("organization_id", ctx.organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", ctx.organizationId)
        .order("name")
        .limit(200),
    ]);
    profile = (profileRes.data as ProfileRow | null) ?? null;
    listings = (listingsRes.data as ListingRow[] | null) ?? [];
    products = (productsRes.data as Array<{ id: string; name: string }> | null) ?? [];
    const requestsRes = await requestsPromise;
    requests = (requestsRes.data as unknown as RequestRow[] | null) ?? [];
    const completedIds = requests.filter((r) => r.state === "completed").map((r) => r.id);
    if (completedIds.length > 0) {
      const { data: fu } = await supabase
        .from("market_followups")
        .select("booking_id")
        .eq("party", "seller")
        .in("booking_id", completedIds);
      sellerFollowedUp = new Set((fu ?? []).map((f) => f.booking_id));
    }
  }

  const pendingRequests = requests.filter((r) => r.state === "pending_seller_approval");
  const activeBookings = requests.filter((r) => r.state !== "pending_seller_approval");

  // Turo-model handoff check: for bookings awaiting identity
  // confirmation, the seller sees the renter's ID + live selfie via
  // short-lived signed URLs (private bucket; org-scoped bookings only).
  const identityChecks = new Map<string, { idUrl: string | null; selfieUrl: string | null }>();
  const needsIdentity = activeBookings.filter(
    (r) => r.state === "ready_for_handoff" && !r.identity_verified_at,
  );
  if (needsIdentity.length > 0) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    const adminClient = createSupabaseAdminClient();
    for (const r of needsIdentity) {
      const { data: v } = await adminClient
        .from("market_renter_verifications")
        .select("id_photo_path, selfie_path")
        .eq("profile_id", r.renter_profile_id)
        .maybeSingle();
      const sign = async (path: string | null) =>
        path
          ? (await adminClient.storage.from("market-identity").createSignedUrl(path, 600)).data
              ?.signedUrl ?? null
          : null;
      identityChecks.set(r.id, {
        idUrl: await sign(v?.id_photo_path ?? null),
        selfieUrl: await sign(v?.selfie_path ?? null),
      });
    }
  }

  const NEXT_STEP: Record<string, { step: string; label: string } | undefined> = {
    confirmed: { step: "ready", label: "Mark ready for handoff" },
    ready_for_handoff: { step: "checkout", label: "Mark checked out" },
    checked_out: { step: "returned", label: "Mark returned" },
    overdue: { step: "returned", label: "Mark returned" },
    returned_pending_review: { step: "complete", label: "Complete (releases hold)" },
  };

  const worldOptions = worlds.map((w) => ({
    slug: w.slug,
    label: w.label,
    status: w.status,
  }));
  const categoryOptions = worlds.flatMap((w) =>
    listWorldCategories(w.slug).map((c) => ({
      worldSlug: w.slug,
      slug: c.slug,
      label: c.label,
    })),
  );

  return (
    <DashboardShell
      title="Marketplace"
      description="Your store page and listings on the Korent marketplace. List free — an 8% operator fee applies only when you get booked."
    >
      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}
      >
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Seller Hub</div>
              <h2 style={{ margin: "6px 0 0" }}>Booking requests</h2>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="order-card" style={{ padding: 16 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                No pending requests. You have 24 hours to respond when one
                arrives — the renter pays nothing unless you accept.
              </span>
            </div>
          ) : (
            <div className="list">
              {pendingRequests.map((r) => (
                <article key={r.id} className="order-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong>{r.market_listings?.title ?? "Listing"}</strong>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {new Date(r.starts_at).toLocaleDateString()} →{" "}
                        {new Date(r.ends_at).toLocaleDateString()} · qty {r.quantity} · $
                        {(r.subtotal_cents / 100).toFixed(0)} total · your payout $
                        {(r.seller_payout_cents / 100).toFixed(0)}
                      </div>
                      {r.renter_message ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          “{r.renter_message}”
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <form action={approveBookingRequest}>
                        <input type="hidden" name="booking_id" value={r.id} />
                        <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
                          Accept
                        </button>
                      </form>
                      <form action={declineBookingRequest}>
                        <input type="hidden" name="booking_id" value={r.id} />
                        <button type="submit" className="secondary-btn" style={{ fontSize: 13 }}>
                          Decline
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeBookings.length > 0 ? (
            <>
              <div className="section-header" style={{ marginTop: 16 }}>
                <div>
                  <div className="kicker">Active bookings</div>
                </div>
              </div>
              <div className="list">
                {activeBookings.map((r) => {
                  const next = NEXT_STEP[r.state];
                  return (
                    <article key={r.id} className="order-card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div>
                          <strong>{r.market_listings?.title ?? "Listing"}</strong>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {new Date(r.starts_at).toLocaleDateString()} →{" "}
                            {new Date(r.ends_at).toLocaleDateString()} · qty {r.quantity} ·
                            payout ${(r.seller_payout_cents / 100).toFixed(0)}
                          </div>
                          <span
                            className={`badge ${["confirmed", "ready_for_handoff", "checked_out"].includes(r.state) ? "success" : ""}`}
                            style={{ marginTop: 6 }}
                          >
                            {r.state === "awaiting_payment" ? "awaiting renter payment" : r.state.replaceAll("_", " ")}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {next && !(r.state === "ready_for_handoff" && !r.identity_verified_at) ? (
                            <form action={advanceBooking}>
                              <input type="hidden" name="booking_id" value={r.id} />
                              <input type="hidden" name="step" value={next.step} />
                              <button type="submit" className="secondary-btn" style={{ fontSize: 13 }}>
                                {next.label}
                              </button>
                            </form>
                          ) : null}
                          {["awaiting_payment", "confirmed", "ready_for_handoff"].includes(r.state) ? (
                            <SellerCancelButton bookingId={r.id} />
                          ) : null}
                          {["confirmed", "ready_for_handoff"].includes(r.state) &&
                          new Date(r.starts_at).getTime() + 30 * 60 * 1000 < Date.now() ? (
                            <RenterNoShowButton bookingId={r.id} />
                          ) : null}
                        </div>
                      </div>
                      {r.state === "ready_for_handoff" && !r.identity_verified_at ? (
                        <div className="order-card" style={{ marginTop: 10, padding: 12, background: "#fef3e2" }}>
                          <strong style={{ fontSize: 13 }}>🪪 Verify the renter before handoff</strong>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Check that the person in front of you matches their ID and
                            live selfie (links expire in 10 minutes — refresh for new
                            ones). Required on every rental. If it doesn't match, cancel
                            the booking or report a no-show — never hand over the item.
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
                            {identityChecks.get(r.id)?.idUrl ? (
                              <a href={identityChecks.get(r.id)!.idUrl!} target="_blank" rel="noreferrer">
                                View ID photo
                              </a>
                            ) : (
                              <span className="muted">No ID on file</span>
                            )}
                            {identityChecks.get(r.id)?.selfieUrl ? (
                              <a href={identityChecks.get(r.id)!.selfieUrl!} target="_blank" rel="noreferrer">
                                View live selfie
                              </a>
                            ) : (
                              <span className="muted">No selfie on file</span>
                            )}
                            <form action={confirmRenterIdentity}>
                              <input type="hidden" name="booking_id" value={r.id} />
                              <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
                                ✓ Identity matches — unlock handoff
                              </button>
                            </form>
                          </div>
                        </div>
                      ) : null}
                      {r.state === "completed" && !sellerFollowedUp.has(r.id) ? (
                        <FollowupForm bookingId={r.id} party="seller" />
                      ) : null}
                      {r.state === "ready_for_handoff" && r.identity_verified_at ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          🪪 Identity confirmed {new Date(r.identity_verified_at).toLocaleString()}
                        </div>
                      ) : null}
                      {r.state === "ready_for_handoff" || r.state === "checked_out" ? (
                        <EvidenceForm bookingId={r.id} phase="handoff" />
                      ) : null}
                      {["checked_out", "overdue", "returned_pending_review"].includes(r.state) ? (
                        <EvidenceForm bookingId={r.id} phase="return" />
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}

          <div className="section-header" style={{ marginTop: 20 }}>
            <div>
              <h2 style={{ margin: "6px 0 0" }}>Your listings</h2>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: "32px 16px" }}>
              <strong>No listings yet.</strong>
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Create your store page, then add your first listing. Hosting &
                Events is live in the DMV — other worlds take pre-listings.
              </div>
            </div>
          ) : (
            <div className="list">
              {listings.map((l) => (
                <article key={l.id} className="order-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{l.title}</strong>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {l.world_slug} / {l.category_slug} · $
                        {(l.daily_price_cents / 100).toFixed(0)}/day · deposit $
                        {(l.deposit_cents / 100).toFixed(0)}
                        {l.is_prelist ? " · pre-list (not bookable until world opens)" : ""}
                      </div>
                      <span
                        className={`badge ${l.status === "published" ? "success" : ""}`}
                        style={{ marginTop: 6 }}
                      >
                        {l.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {l.status !== "published" ? (
                        <form action={publishListing}>
                          <input type="hidden" name="listing_id" value={l.id} />
                          <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
                            Publish
                          </button>
                        </form>
                      ) : (
                        <form action={pauseListing}>
                          <input type="hidden" name="listing_id" value={l.id} />
                          <button type="submit" className="secondary-btn" style={{ fontSize: 13 }}>
                            Pause
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <CreateListingForm
              worlds={worldOptions}
              categories={categoryOptions}
              products={products}
            />
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Store page</div>
              <h2 style={{ margin: "6px 0 0" }}>
                {profile ? `/store/${profile.slug}` : "Create your store page"}
              </h2>
            </div>
          </div>
          <SellerProfileForm
            profile={
              profile
                ? {
                    slug: profile.slug,
                    displayName: profile.display_name,
                    bio: profile.bio,
                    serviceRadiusMiles: profile.service_radius_miles,
                    stateCode: profile.state_code,
                    offersDelivery: profile.offers_delivery,
                    offersPickup: profile.offers_pickup,
                  }
                : null
            }
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
            Your store page lives <b>inside</b> the marketplace at
            rent.korent.app/store/your-url — it is not a separate website, and
            it never links off-platform. Your white-label storefront website
            (your subdomain) is unchanged and separate.
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DisputeResolveForm } from "@/components/market/dispute-resolve-form";
import { approveListing, rejectListing } from "@/lib/market/listing-review-actions";
import { resolveSupportRequest } from "@/lib/market/support-actions";
import { markFollowupReviewed } from "@/lib/market/followup-actions";

export const dynamic = "force-dynamic";

type DisputeRow = {
  id: string;
  dispute_type: string;
  status: string;
  opened_by: string;
  description: string;
  created_at: string;
  market_bookings: {
    id: string;
    deposit_cents: number;
    deposit_status: string;
    renter_profile_id: string;
    market_listings: { title: string } | null;
  } | null;
};

function isPlatformAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/**
 * Trust/admin queue v1 (§19): the disputes queue. Gated to
 * PLATFORM_ADMIN_EMAILS — invisible (404) to everyone else.
 */
export default async function MarketAdminPage() {
  if (!hasSupabaseEnv()) notFound();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) notFound();

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("market_disputes")
    .select(
      "id, dispute_type, status, opened_by, description, created_at, market_bookings ( id, deposit_cents, deposit_status, renter_profile_id, market_listings ( title ) )",
    )
    .in("status", ["open", "awaiting_renter_evidence", "awaiting_seller_evidence", "admin_review"])
    .order("created_at", { ascending: true })
    .limit(50);
  const disputes = (data as unknown as DisputeRow[] | null) ?? [];

  const { data: pendingListings } = await admin
    .from("market_listings")
    .select(
      "id, title, world_slug, category_slug, condition, daily_price_cents, replacement_value_cents, created_at, market_seller_profiles ( display_name )",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(50);

  // Founder requirement: renter identity (private bucket) is viewable
  // ONLY here, only when a dispute exists — 10-minute signed URLs.
  const identityLinks = new Map<string, { idUrl: string | null; selfieUrl: string | null }>();
  for (const d of disputes) {
    const renterId = d.market_bookings?.renter_profile_id;
    if (!renterId || identityLinks.has(renterId)) continue;
    const { data: v } = await admin
      .from("market_renter_verifications")
      .select("id_photo_path, selfie_path")
      .eq("profile_id", renterId)
      .maybeSingle();
    if (!v?.id_photo_path && !v?.selfie_path) continue;
    const sign = async (path: string | null) =>
      path
        ? (await admin.storage.from("market-identity").createSignedUrl(path, 600)).data
            ?.signedUrl ?? null
        : null;
    identityLinks.set(renterId, {
      idUrl: await sign(v.id_photo_path),
      selfieUrl: await sign(v.selfie_path),
    });
  }

  const { data: flaggedFollowups } = await admin
    .from("market_followups")
    .select(
      "id, party, overall, item_issue, suspicious, would_repeat, notes, created_at, market_bookings ( id, market_listings ( title ) )",
    )
    .eq("status", "flagged")
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: supportRequests } = await admin
    .from("market_support_requests")
    .select("id, email, topic, message, created_at, booking_id")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(50);

  return (
    <DashboardShell
      title="Marketplace trust queue"
      description="Open disputes, oldest first. Resolution is the only path that captures a deposit. SLA: acknowledge immediately, simple resolution 72h."
    >
      {(pendingListings ?? []).length > 0 ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="kicker">Listing moderation</div>
          <h2 style={{ margin: "6px 0 12px" }}>
            {(pendingListings ?? []).length} listing
            {(pendingListings ?? []).length === 1 ? "" : "s"} awaiting review
          </h2>
          <div className="list">
            {(pendingListings ?? []).map((l) => (
              <article key={l.id} className="order-card">
                <strong>{l.title}</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {(l.market_seller_profiles as unknown as { display_name: string } | null)?.display_name ?? "Seller"} ·{" "}
                  {l.world_slug}/{l.category_slug} · {l.condition} · $
                  {(l.daily_price_cents / 100).toFixed(0)}/day
                  {l.replacement_value_cents
                    ? ` · replacement $${(l.replacement_value_cents / 100).toFixed(0)}`
                    : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <form action={approveListing}>
                    <input type="hidden" name="listing_id" value={l.id} />
                    <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
                      Approve & publish
                    </button>
                  </form>
                  <form action={rejectListing} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="listing_id" value={l.id} />
                    <input
                      name="reason"
                      required
                      maxLength={500}
                      placeholder="Rejection reason (seller sees this)"
                      style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e0d8" }}
                    />
                    <button type="submit" className="secondary-btn" style={{ fontSize: 13 }}>
                      Reject
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(flaggedFollowups ?? []).length > 0 ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="kicker">Flagged follow-ups</div>
          <h2 style={{ margin: "6px 0 12px" }}>
            {(flaggedFollowups ?? []).length} post-rental flag
            {(flaggedFollowups ?? []).length === 1 ? "" : "s"}
          </h2>
          <div className="list">
            {(flaggedFollowups ?? []).map((f) => {
              const title =
                (f.market_bookings as unknown as { market_listings: { title: string } | null } | null)
                  ?.market_listings?.title ?? "Listing";
              return (
                <article key={f.id} className="order-card">
                  <strong>
                    {title} — {f.party} says: {f.overall}
                  </strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {f.item_issue ? "⚠️ item issue · " : ""}
                    {f.suspicious ? "🚩 suspicious activity · " : ""}
                    {f.would_repeat === false ? "would NOT rent again · " : ""}
                    {new Date(f.created_at).toLocaleString()}
                  </div>
                  {f.notes ? (
                    <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                      “{f.notes}”
                    </p>
                  ) : null}
                  <form action={markFollowupReviewed} style={{ marginTop: 8 }}>
                    <input type="hidden" name="followup_id" value={f.id} />
                    <button type="submit" className="secondary-btn" style={{ fontSize: 13 }}>
                      Mark reviewed
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {(supportRequests ?? []).length > 0 ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="kicker">Support inbox</div>
          <h2 style={{ margin: "6px 0 12px" }}>
            {(supportRequests ?? []).length} open request
            {(supportRequests ?? []).length === 1 ? "" : "s"}
          </h2>
          <div className="list">
            {(supportRequests ?? []).map((r) => (
              <article key={r.id} className="order-card">
                <strong>{r.topic}</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {r.email} · {new Date(r.created_at).toLocaleString()}
                  {r.booking_id ? ` · booking ${r.booking_id.slice(0, 8)}…` : ""}
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  “{r.message}”
                </p>
                <form action={resolveSupportRequest} style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="request_id" value={r.id} />
                  <input
                    name="note"
                    maxLength={1000}
                    placeholder="Resolution note (optional)"
                    style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e0d8", flex: 1, minWidth: 180 }}
                  />
                  <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
                    Mark resolved
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        {disputes.length === 0 ? (
          <div className="order-card" style={{ padding: 16 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Queue is clear — no open disputes.
            </span>
          </div>
        ) : (
          <div className="list">
            {disputes.map((d) => (
              <article key={d.id} className="order-card">
                <strong>
                  {d.market_bookings?.market_listings?.title ?? "Listing"} —{" "}
                  {d.dispute_type.replaceAll("_", " ")}
                </strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  opened by {d.opened_by} · {new Date(d.created_at).toLocaleString()} · deposit $
                  {((d.market_bookings?.deposit_cents ?? 0) / 100).toFixed(0)} (
                  {d.market_bookings?.deposit_status ?? "none"})
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  “{d.description}”
                </p>
                {(() => {
                  const ident = d.market_bookings?.renter_profile_id
                    ? identityLinks.get(d.market_bookings.renter_profile_id)
                    : undefined;
                  return ident ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Renter identity (10-min links):{" "}
                      {ident.idUrl ? (
                        <a href={ident.idUrl} target="_blank" rel="noreferrer">
                          ID photo
                        </a>
                      ) : (
                        "no ID"
                      )}{" "}
                      ·{" "}
                      {ident.selfieUrl ? (
                        <a href={ident.selfieUrl} target="_blank" rel="noreferrer">
                          live selfie
                        </a>
                      ) : (
                        "no selfie"
                      )}
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      No identity on file for this renter.
                    </div>
                  );
                })()}
                <DisputeResolveForm
                  disputeId={d.id}
                  depositCents={d.market_bookings?.deposit_cents ?? 0}
                  depositStatus={d.market_bookings?.deposit_status ?? "none"}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

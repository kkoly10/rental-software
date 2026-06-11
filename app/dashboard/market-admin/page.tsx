import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DisputeResolveForm } from "@/components/market/dispute-resolve-form";

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
      "id, dispute_type, status, opened_by, description, created_at, market_bookings ( id, deposit_cents, deposit_status, market_listings ( title ) )",
    )
    .in("status", ["open", "awaiting_renter_evidence", "awaiting_seller_evidence", "admin_review"])
    .order("created_at", { ascending: true })
    .limit(50);
  const disputes = (data as unknown as DisputeRow[] | null) ?? [];

  return (
    <DashboardShell
      title="Marketplace trust queue"
      description="Open disputes, oldest first. Resolution is the only path that captures a deposit. SLA: acknowledge immediately, simple resolution 72h."
    >
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

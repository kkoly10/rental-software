import { DashboardShell } from "@/components/layout/dashboard-shell";
import { unlockFullToolkit } from "@/lib/market/toolkit-actions";

export const dynamic = "force-dynamic";

/**
 * The Seller-Central → full-SaaS door: marketplace sellers see the
 * trimmed nav until they explicitly unlock the operator toolkit.
 * Free on the same freemium plan limits as any operator account.
 */
export default function UnlockToolkitPage() {
  return (
    <DashboardShell
      title="Unlock the full operator toolkit"
      description="Everything your marketplace store has — plus your own website, delivery routing, CRM and invoicing."
    >
      <section className="panel" style={{ maxWidth: 720 }}>
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="order-card">
            <strong>Your own storefront</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              A white-label rental website on your own subdomain, with online
              checkout — separate from your marketplace store page.
            </div>
          </div>
          <div className="order-card">
            <strong>Operations</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              Orders, calendar, delivery routing, crew mobile, maintenance —
              the tools full-time rental companies run on.
            </div>
          </div>
          <div className="order-card">
            <strong>Back office</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              Customers (CRM), documents &amp; invoices, payments and
              analytics. Free to start; upgrade plans only when you outgrow
              the limits.
            </div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
          Unlocking doesn&rsquo;t change your marketplace store, listings or
          bookings — it adds the rest of Korent alongside them. You can keep
          using the marketplace Seller Hub either way.
        </p>
        <form action={unlockFullToolkit}>
          <button type="submit" className="primary-btn">
            Unlock the full toolkit — free
          </button>
        </form>
      </section>
    </DashboardShell>
  );
}

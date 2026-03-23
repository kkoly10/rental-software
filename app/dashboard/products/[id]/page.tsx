import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ProductDetailEditorPage() {
  return (
    <DashboardShell
      title="Product Detail"
      description="Edit pricing, specs, availability rules, and public catalog content."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Catalog item</div>
              <h2 style={{ margin: "6px 0 0" }}>Mega Splash Water Slide</h2>
            </div>
            <StatusBadge label="Active" tone="success" />
          </div>
          <div className="list">
            <div className="order-card">
              <strong>Public content</strong>
              <div className="muted">Name, slug, short description, long description, gallery.</div>
            </div>
            <div className="order-card">
              <strong>Rental rules</strong>
              <div className="muted">Flat day pricing, delivery required, deposit enabled, date buffers.</div>
            </div>
            <div className="order-card">
              <strong>Specs</strong>
              <div className="muted">Dimensions, setup surface, power requirements, recommended age.</div>
            </div>
            <div className="order-card">
              <strong>Availability</strong>
              <div className="muted">Maintenance holds, blackout dates, prep time, cleaning buffer.</div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Pricing summary</div>
              <h2 style={{ margin: "6px 0 0" }}>Current settings</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">Base price: $279/day</div>
            <div className="order-card">Security deposit: $75</div>
            <div className="order-card">Category: Water Slide</div>
            <div className="order-card">Delivery mode: Required</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/inventory/mega-splash-water-slide" className="secondary-btn">
              View public page
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

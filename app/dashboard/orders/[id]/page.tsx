import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";

export default function OrderDetailPage() {
  return (
    <DashboardShell
      title="Order Detail"
      description="Single booking view for customer info, pricing, documents, and delivery readiness."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Order #1001</div>
              <h2 style={{ margin: "6px 0 0" }}>Johnson Birthday Setup</h2>
            </div>
            <StatusBadge label="Confirmed" tone="success" />
          </div>
          <div className="list">
            <div className="order-card">
              <strong>Customer</strong>
              <div className="muted">Ashley Johnson · ashley@example.com · (540) 555-0102</div>
            </div>
            <div className="order-card">
              <strong>Rental items</strong>
              <div className="muted">Castle Bouncer · Generator Add-on</div>
            </div>
            <div className="order-card">
              <strong>Delivery</strong>
              <div className="muted">May 24, 2026 · 9:00 AM · Stafford, VA 22554</div>
            </div>
            <div className="order-card">
              <strong>Documents</strong>
              <div className="muted">Rental agreement signed · Safety waiver signed</div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Financials</div>
              <h2 style={{ margin: "6px 0 0" }}>Summary</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">Subtotal: $225</div>
            <div className="order-card">Delivery fee: $20</div>
            <div className="order-card">Deposit paid: $75</div>
            <div className="order-card">Balance due: $170</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/deliveries" className="secondary-btn">
              View delivery board
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

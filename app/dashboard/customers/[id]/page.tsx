import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function CustomerDetailPage() {
  return (
    <DashboardShell
      title="Customer Detail"
      description="View contact details, booking history, notes, and saved addresses."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Customer profile</div>
              <h2 style={{ margin: "6px 0 0" }}>Ashley Johnson</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">
              <strong>Contact</strong>
              <div className="muted">ashley@example.com · (540) 555-0102</div>
            </div>
            <div className="order-card">
              <strong>Saved address</strong>
              <div className="muted">Stafford, VA 22554 · Backyard birthday setup</div>
            </div>
            <div className="order-card">
              <strong>Notes</strong>
              <div className="muted">
                Repeat customer. Prefers early setup window and text reminders.
              </div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Booking history</div>
              <h2 style={{ margin: "6px 0 0" }}>Recent orders</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">Johnson Birthday Setup · Confirmed · $245</div>
            <div className="order-card">Neighborhood Cookout · Completed · $190</div>
            <div className="order-card">Church Family Day Referral · Inquiry</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/orders" className="secondary-btn">
              View all orders
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
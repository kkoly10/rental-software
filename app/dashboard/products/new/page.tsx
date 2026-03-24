import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function NewProductPage() {
  return (
    <DashboardShell
      title="Add Product"
      description="Create a new rentable item for the public catalog and booking flow."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Catalog creation</div>
            <h2 style={{ margin: "6px 0 0" }}>New inflatable product</h2>
          </div>
        </div>
        <div className="list">
          <div className="order-card">
            <strong>Basics</strong>
            <div className="muted">Name, slug, category, active status, and public visibility.</div>
          </div>
          <div className="order-card">
            <strong>Pricing</strong>
            <div className="muted">Base day price, deposit amount, and delivery settings.</div>
          </div>
          <div className="order-card">
            <strong>Product details</strong>
            <div className="muted">Description, setup notes, dimensions, power requirements, and age guidance.</div>
          </div>
          <div className="order-card">
            <strong>Availability rules</strong>
            <div className="muted">Delivery required, prep buffer, cleaning buffer, and blackout dates.</div>
          </div>
          <div className="order-card">
            <strong>Media</strong>
            <div className="muted">Primary image, gallery images, and future real-event photo support.</div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

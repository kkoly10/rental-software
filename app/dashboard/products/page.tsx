import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";

const products = [
  {
    id: "prod_castle_bouncer",
    name: "Castle Bouncer",
    category: "Bounce House",
    price: "$165/day",
    status: "Active",
    tone: "success" as const,
  },
  {
    id: "prod_mega_splash",
    name: "Mega Splash Water Slide",
    category: "Water Slide",
    price: "$279/day",
    status: "Active",
    tone: "success" as const,
  },
  {
    id: "prod_tropical_combo",
    name: "Tropical Combo",
    category: "Combo Unit",
    price: "$235/day",
    status: "Maintenance",
    tone: "warning" as const,
  },
];

export default function ProductsPage() {
  return (
    <DashboardShell
      title="Products"
      description="Manage public catalog items, pricing, categories, and rental readiness."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Catalog management</div>
            <h2 style={{ margin: "6px 0 0" }}>Product inventory</h2>
          </div>
          <Link href="/dashboard/products/new" className="primary-btn">
            Add product
          </Link>
        </div>
        <div className="list">
          {products.map((product) => (
            <article key={product.id} className="order-card">
              <div className="order-row">
                <div>
                  <strong>{product.name}</strong>
                  <div className="muted">{product.category}</div>
                </div>
                <StatusBadge label={product.status} tone={product.tone} />
              </div>
              <div className="price-row">
                <span className="muted">{product.price}</span>
                <Link href={`/dashboard/products/${product.id}`} className="ghost-btn">
                  Edit product
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}

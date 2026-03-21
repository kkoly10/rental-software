import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { StatusBadge } from "@/components/ui/status-badge";

const products = [
  { name: "Castle Bouncer", price: "$165/day", tone: "success" as const },
  { name: "Mega Splash Slide", price: "$279/day", tone: "success" as const },
  { name: "Tropical Combo", price: "$235/day", tone: "warning" as const },
  { name: "Jungle Course", price: "$345/day", tone: "success" as const },
  { name: "Cotton Candy Machine", price: "$95/day", tone: "default" as const },
  { name: "Generator Add-on", price: "$60/day", tone: "default" as const }
];

export default function InventoryPage() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container">
          <div className="section-header">
            <div>
              <div className="kicker">Catalog</div>
              <h1 style={{ margin: "6px 0 8px" }}>Browse inflatables</h1>
              <div className="muted">Filter by date, ZIP, and category.</div>
            </div>
          </div>
          <div className="filters">
            <input defaultValue="May 24, 2026" aria-label="Date" />
            <input defaultValue="22554" aria-label="ZIP code" />
            <select defaultValue="All categories" aria-label="Category">
              <option>All categories</option>
              <option>Bounce houses</option>
              <option>Water slides</option>
              <option>Combos</option>
              <option>Add-ons</option>
            </select>
            <select defaultValue="Available only" aria-label="Availability">
              <option>Available only</option>
              <option>Include maintenance</option>
            </select>
            <button className="primary-btn">Apply Filters</button>
          </div>
          <div className="grid grid-3">
            {products.map((product) => (
              <article key={product.name} className="product-card">
                <div className="product-media" />
                <div className="product-copy">
                  <div className="price-row" style={{ marginTop: 0 }}>
                    <div className="kicker">Inflatable inventory</div>
                    <StatusBadge
                      label={product.tone === "success" ? "Available" : product.tone === "warning" ? "Limited" : "Add-on"}
                      tone={product.tone}
                    />
                  </div>
                  <h3 style={{ margin: "8px 0 4px" }}>{product.name}</h3>
                  <div className="price-row">
                    <strong>{product.price}</strong>
                    <Link href="/inventory/mega-splash-water-slide" className="secondary-btn">View Details</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

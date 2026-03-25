import { PublicHeader } from "@/components/layout/public-header";
import { CatalogGrid } from "@/components/public/catalog-grid";
import { getCatalogList } from "@/lib/data/catalog-list";

export default async function InventoryPage() {
  const products = await getCatalogList();

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

          <CatalogGrid products={products} />
        </div>
      </main>
    </>
  );
}
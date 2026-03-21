import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ProductDetailPage() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container two-col">
          <section className="panel">
            <div className="product-media" style={{ height: 320, borderRadius: 18 }} />
            <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 14 }}>
              <div className="product-media" style={{ height: 80, borderRadius: 12 }} />
              <div className="product-media" style={{ height: 80, borderRadius: 12 }} />
              <div className="product-media" style={{ height: 80, borderRadius: 12 }} />
              <div className="product-media" style={{ height: 80, borderRadius: 12 }} />
            </div>
          </section>
          <aside className="panel">
            <div className="price-row" style={{ marginTop: 0 }}>
              <div className="kicker">Water slide</div>
              <StatusBadge label="Available" tone="success" />
            </div>
            <h1 style={{ margin: "8px 0 6px" }}>Mega Splash Water Slide</h1>
            <p className="muted">Inflatable-first product page with room for party specs and trailer specs later.</p>
            <div className="price-row">
              <strong style={{ fontSize: "2rem" }}>$279/day</strong>
              <span className="badge">Deposit at checkout</span>
            </div>
            <div className="list" style={{ marginTop: 16 }}>
              <div className="order-card">Setup area: grass preferred, flat and clear</div>
              <div className="order-card">Power: dedicated outlet or generator</div>
              <div className="order-card">Includes: blower, stakes, safety overview</div>
              <div className="order-card">Turnaround and cleaning buffers enabled</div>
            </div>
            <div className="price-row" style={{ marginTop: 18 }}>
              <Link href="/checkout" className="primary-btn">Reserve Now</Link>
              <Link href="/inventory" className="secondary-btn">Back</Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

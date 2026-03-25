import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getWebsiteAdminData } from "@/lib/data/website-admin";

export default async function WebsitePage() {
  const data = await getWebsiteAdminData();

  return (
    <DashboardShell
      title="Website"
      description="Manage homepage messaging, highlighted inventory, and storefront presentation."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Public site</div>
              <h2 style={{ margin: "6px 0 0" }}>Storefront controls</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>Homepage message</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {data.settings.websiteMessage}
              </div>
            </article>

            <article className="order-card">
              <strong>Service area presentation</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {data.settings.serviceAreaLabel}
              </div>
            </article>

            <article className="order-card">
              <strong>Public booking state</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {data.settings.publicBookingLabel}
              </div>
            </article>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Homepage preview data</div>
              <h2 style={{ margin: "6px 0 0" }}>Featured inventory</h2>
            </div>
          </div>

          <div className="list">
            {data.featuredProducts.length > 0 ? (
              data.featuredProducts.map((product) => (
                <article key={product.id} className="order-card">
                  <strong>{product.name}</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {product.category}
                  </div>
                  <div className="muted">{product.price}</div>
                </article>
              ))
            ) : (
              <article className="order-card">
                <strong>No featured products</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  Add active products to populate the public homepage.
                </div>
              </article>
            )}
          </div>

          <div className="section-header" style={{ marginTop: 18 }}>
            <div>
              <div className="kicker">Area highlights</div>
            </div>
          </div>

          <div className="list">
            {data.serviceAreas.length > 0 ? (
              data.serviceAreas.map((area) => (
                <article key={area.id} className="order-card">
                  <strong>{area.name}</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Delivery fee: {area.fee}
                  </div>
                  <div className="muted">{area.minimum}</div>
                </article>
              ))
            ) : (
              <article className="order-card">
                <strong>No active service areas</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  Add ZIP coverage to improve storefront clarity.
                </div>
              </article>
            )}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

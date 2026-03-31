import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WebsiteSettingsForm } from "@/components/settings/website-settings-form";
import { BrandSettingsForm } from "@/components/settings/brand-settings-form";
import { FaqManager } from "@/components/settings/faq-manager";
import { AboutEditor } from "@/components/settings/about-editor";
import { TestimonialsManager } from "@/components/settings/testimonials-manager";
import { TrustBadgesEditor } from "@/components/settings/trust-badges-editor";
import { SectionVisibilityForm } from "@/components/settings/section-visibility-form";
import { getWebsiteAdminData } from "@/lib/data/website-admin";
import { getOrgSettings } from "@/lib/data/settings";
import { getBrandSettings } from "@/lib/data/brand";
import { getContentSettings } from "@/lib/data/content-settings";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";

export default async function WebsitePage() {
  const [data, editableSettings, brandSettings, contentSettings] = await Promise.all([
    getWebsiteAdminData(),
    getOrgSettings(),
    getBrandSettings(),
    getContentSettings(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/website"];

  return (
    <DashboardShell
      title="Website"
      description="Manage homepage messaging, highlighted inventory, and storefront presentation."
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}

      <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "var(--surface-muted)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your public storefront</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Changes you make here update YOUR public storefront — the website your customers see when they visit your booking page.
          </div>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="secondary-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          Preview Your Storefront
          <span style={{ fontSize: 13 }}>&#8599;</span>
        </a>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Public site</div>
              <h2 style={{ margin: "6px 0 0" }}>Website controls</h2>
            </div>
          </div>

          <WebsiteSettingsForm
            defaults={{
              heroMessage: editableSettings.heroMessage || data.settings.websiteMessage,
              serviceAreaText: editableSettings.serviceAreaText || data.settings.serviceAreaLabel,
              bookingMessage: editableSettings.bookingMessage || "",
            }}
          />
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

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Storefront</div>
              <h2 style={{ margin: "6px 0 0" }}>Brand &amp; Appearance</h2>
            </div>
          </div>

          <BrandSettingsForm
            defaults={{
              logoUrl: brandSettings.logoUrl,
              primaryColor: brandSettings.primaryColor,
              accentColor: brandSettings.accentColor,
              fontFamily: brandSettings.fontFamily,
            }}
          />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Homepage Content</div>
              <h2 style={{ margin: "6px 0 0" }}>FAQ Manager</h2>
            </div>
          </div>

          <FaqManager defaults={contentSettings.customFaq} />
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Homepage Content</div>
              <h2 style={{ margin: "6px 0 0" }}>About Section</h2>
            </div>
          </div>

          <AboutEditor defaultValue={contentSettings.aboutText} />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Social Proof</div>
              <h2 style={{ margin: "6px 0 0" }}>Testimonials</h2>
            </div>
          </div>

          <TestimonialsManager defaults={contentSettings.testimonials} />
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Social Proof</div>
              <h2 style={{ margin: "6px 0 0" }}>Trust Badges</h2>
            </div>
          </div>

          <TrustBadgesEditor defaults={contentSettings.trustBadges} />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Layout</div>
              <h2 style={{ margin: "6px 0 0" }}>Section Visibility</h2>
            </div>
          </div>

          <SectionVisibilityForm defaults={contentSettings.sectionVisibility} />
        </section>
      </div>
    </DashboardShell>
  );
}

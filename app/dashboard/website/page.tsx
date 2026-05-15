import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WebsiteSettingsForm } from "@/components/settings/website-settings-form";
import { BrandSettingsForm } from "@/components/settings/brand-settings-form";
import { HeroImageUpload } from "@/components/settings/hero-image-upload";
import { SocialLinksForm } from "@/components/settings/social-links-form";
import { FaqManager } from "@/components/settings/faq-manager";
import { AboutEditor } from "@/components/settings/about-editor";
import { TestimonialsManager } from "@/components/settings/testimonials-manager";
import { TrustBadgesEditor } from "@/components/settings/trust-badges-editor";
import { SectionVisibilityForm } from "@/components/settings/section-visibility-form";
import { NavLinksEditor } from "@/components/settings/nav-links-editor";
import { DomainSettingsPanel } from "@/components/settings/domain-settings-panel";
import { getWebsiteAdminData } from "@/lib/data/website-admin";
import { getOrgSettings } from "@/lib/data/settings";
import { getBrandSettings } from "@/lib/data/brand";
import { getContentSettings } from "@/lib/data/content-settings";
import { getDomainSettings } from "@/lib/data/domain-settings";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { buildStorefrontUrl } from "@/lib/storefront/url";
import { headers } from "next/headers";
import { getMessages } from "@/lib/i18n/server";

export default async function WebsitePage() {
  const [data, editableSettings, brandSettings, contentSettings, domainSettings, headersList, m] = await Promise.all([
    getWebsiteAdminData(),
    getOrgSettings(),
    getBrandSettings(),
    getContentSettings(),
    getDomainSettings(),
    headers(),
    getMessages(),
  ]);
  const guidanceState = await getGuidanceState();
  const requestHost = headersList.get("host") ?? undefined;
  const storefrontUrl = buildStorefrontUrl(domainSettings, requestHost);
  const pageConfig = pageHelpMap["/dashboard/website"];
  const helpConfig = pageConfig
    ? {
        ...pageConfig,
        primaryAction: storefrontUrl
          ? { label: pageConfig.primaryAction?.label ?? m.dashboard.website.viewStorefront, href: storefrontUrl }
          : undefined,
      }
    : undefined;

  return (
    <DashboardShell
      title={m.dashboard.website.title}
      description={m.dashboard.website.description}
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}

      <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "var(--surface-muted)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{m.dashboard.website.sectionTitle}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {m.dashboard.website.sectionBody}
          </div>
        </div>
        {storefrontUrl ? (
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          >
            {m.dashboard.website.preview}
            <span style={{ fontSize: 13 }}>&#8599;</span>
          </a>
        ) : (
          <span className="secondary-btn" style={{ opacity: 0.45, cursor: "default", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            {m.dashboard.website.setupDomainFirst}
          </span>
        )}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.websiteControls}</h2>
            </div>
          </div>

          <WebsiteSettingsForm
            defaults={{
              heroHeadline: editableSettings.heroHeadline || "",
              heroMessage: editableSettings.heroMessage || data.settings.websiteMessage,
              serviceAreaText: editableSettings.serviceAreaText || data.settings.serviceAreaLabel,
              bookingMessage: editableSettings.bookingMessage || "",
            }}
          />

          <div style={{ marginTop: 16 }}>
            <HeroImageUpload currentUrl={editableSettings.heroImageUrl || ""} />
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerHomepagePreview}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.featuredInventory}</h2>
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
                <strong>{m.dashboard.website.noFeaturedProducts}</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  Add active products to populate the public homepage.
                </div>
              </article>
            )}
          </div>

          <div className="section-header" style={{ marginTop: 18 }}>
            <div>
              <div className="kicker">{m.dashboard.website.kickerAreaHighlights}</div>
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
                <strong>{m.dashboard.website.noActiveServiceAreas}</strong>
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
              <div className="kicker">{m.dashboard.website.kickerStorefront}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.domainUrl}</h2>
            </div>
          </div>

          <DomainSettingsPanel defaults={domainSettings} />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerStorefront}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.brandAppearance}</h2>
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
              <div className="kicker">{m.dashboard.website.kickerStorefront}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.socialMedia}</h2>
            </div>
          </div>

          <SocialLinksForm
            defaults={{
              facebook: editableSettings.socialFacebook || "",
              instagram: editableSettings.socialInstagram || "",
              tiktok: editableSettings.socialTiktok || "",
              googleBusiness: editableSettings.socialGoogleBusiness || "",
            }}
          />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerHomepageContent}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.faqTitle}</h2>
            </div>
          </div>

          <FaqManager defaults={contentSettings.customFaq} />
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerHomepageContent}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.aboutSection}</h2>
            </div>
          </div>

          <AboutEditor defaultValue={contentSettings.aboutText} />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerSocialProof}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.testimonialsTitle}</h2>
            </div>
          </div>

          <TestimonialsManager defaults={contentSettings.testimonials} />
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerSocialProof}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.trustBadgesTitle}</h2>
            </div>
          </div>

          <TrustBadgesEditor defaults={contentSettings.trustBadges} />
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerLayout}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.navigationLinks}</h2>
            </div>
          </div>

          <NavLinksEditor defaults={contentSettings.navLinks} />
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.website.kickerLayout}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.website.sectionVisibilityTitle}</h2>
            </div>
          </div>

          <SectionVisibilityForm defaults={contentSettings.sectionVisibility} />
        </section>
      </div>
    </DashboardShell>
  );
}

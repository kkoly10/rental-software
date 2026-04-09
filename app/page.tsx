import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { ProductCard } from "@/components/public/product-card";
import { TrustBar } from "@/components/public/trust-bar";
import { CategoryGrid } from "@/components/public/category-grid";
import { HowItWorks } from "@/components/public/how-it-works";
import { FaqSection } from "@/components/public/faq-section";
import { ServiceAreaSection } from "@/components/public/service-area-section";
import { TestimonialsSection } from "@/components/public/testimonials-section";
import { AboutSection } from "@/components/public/about-section";
import { PublicFooter } from "@/components/public/public-footer";
import { SaasLanding } from "@/components/marketing/saas-landing";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { isTenantHost } from "@/lib/auth/org-context";
import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { getContentSettings } from "@/lib/data/content-settings";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { JsonLdScript } from "@/components/seo/json-ld-script";

export async function generateMetadata(): Promise<Metadata> {
  const isTenant = await isTenantHost();
  if (!isTenant) {
    return buildPageMetadata({
      title: "Korent | Rental software for operators",
      description:
        "Korent helps rental operators run bookings, inventory, payments, delivery routes, and customer documents from one platform.",
      path: "/",
    });
  }

  await requirePublicOrg();
  const settings = await getOrganizationSettings();

  return buildPageMetadata({
    title: `${settings.businessName} | Bounce house & party rentals`,
    description: `${settings.businessName} offers bounce houses, water slides, and party rentals with delivery and setup across ${settings.serviceAreaLabel}. Check availability and book online.`,
    path: "/",
  });
}

const defaultFaqItems = [
  {
    question: "How does booking work?",
    answer:
      "Choose your date, event window, and delivery ZIP, then reserve your rentals online in a few minutes.",
  },
  {
    question: "Do you deliver and set everything up?",
    answer:
      "Yes. Our crew delivers, anchors, and sets up your rentals before your event, then returns for takedown and pickup.",
  },
  {
    question: "What if weather changes?",
    answer:
      "If rain or unsafe weather is expected, we offer flexible rescheduling to a new available date.",
  },
  {
    question: "How far ahead should I reserve?",
    answer:
      "Weekend dates and school-event weekends book quickly, so reserving 1-2 weeks ahead is recommended.",
  },
];

export default async function HomePage() {
  // Root domain (no tenant resolved) → SaaS marketing page for operators
  // Tenant subdomains/custom domains → operator's storefront for end customers
  const isTenant = await isTenantHost();
  if (!isTenant) {
    return <SaasLanding />;
  }

  await requirePublicOrg();

  const [featured, settings, geoAreas, contentSettings, isDemo] = await Promise.all([
    getFeaturedCatalogList(),
    getOrganizationSettings(),
    getServiceAreasGeo(),
    getContentSettings(),
    isCurrentTenantDemo(),
  ]);

  const vis = contentSettings.sectionVisibility;
  const faqItems =
    contentSettings.customFaq && contentSettings.customFaq.length > 0
      ? contentSettings.customFaq
      : defaultFaqItems;

  return (
    <>
      <PublicHeader />
      <JsonLdScript data={organizationJsonLd(settings)} />
      {vis.faq_section !== false && (
        <JsonLdScript data={faqJsonLd(faqItems)} />
      )}

      <main>
        {/* Hero */}
        <section className="public-hero">
          <div className="public-hero-visual">
            <Image
              src={settings.heroImageUrl || "https://images.unsplash.com/photo-1633846764938-548112c2dcee?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=2400"}
              alt={`${settings.businessName} — inflatable party rental setup`}
              fill
              priority
              sizes="100vw"
              className="public-hero-photo"
            />
          </div>

          <div className="public-hero-overlay" />

          <div className="container">
            <div className="public-hero-copy">
              <div className="kicker public-kicker">
                Bounce houses, water slides, and party rentals
              </div>

              <h1>
                {settings.heroHeadline || "Party rentals delivered, set up, and ready for fun"}
              </h1>

              <p>
                {settings.websiteMessage || "Perfect for birthdays, school events, church gatherings, and neighborhood celebrations."}{" "}
                Check availability by date, time, and ZIP code for delivery across{" "}
                {settings.serviceAreaLabel}.
              </p>

              <form action="/inventory" className="storefront-search-card">
                <div className="storefront-search-grid">
                  <label className="storefront-field">
                    <span>Event Date</span>
                    <input name="date" type="date" />
                  </label>

                  <label className="storefront-field">
                    <span>Start Time</span>
                    <input name="start" type="time" />
                  </label>

                  <label className="storefront-field">
                    <span>End Time</span>
                    <input name="end" type="time" />
                  </label>

                  <label className="storefront-field">
                    <span>Delivery ZIP</span>
                    <input
                      name="zip"
                      type="text"
                      placeholder="22554"
                      inputMode="numeric"
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-btn storefront-search-btn"
                  >
                    Check Availability
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Trust signals */}
        {vis.trust_bar !== false && (
          <TrustBar customBadges={contentSettings.trustBadges} />
        )}

        {/* Category browsing */}
        {vis.category_grid !== false && <CategoryGrid />}

        {/* Popular rentals */}
        <section className="section storefront-section-soft">
          <div className="container">
            <div className="section-header">
              <div>
                <div className="kicker">Explore by rentals</div>
                <h2>Popular Rentals</h2>
                <div className="muted">
                  Start with the units families book most often for birthdays,
                  school events, and backyard celebrations.
                </div>
              </div>

              <Link href="/inventory" className="ghost-btn">
                Browse all
              </Link>
            </div>

            <div className="grid grid-4">
              {featured.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  category={product.category}
                  description={product.description}
                  status={product.status}
                  imageUrl={product.imageUrl}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        {vis.how_it_works !== false && (
          <div id="how-it-works">
            <HowItWorks />
          </div>
        )}

        {/* Service area */}
        {vis.service_area_map !== false && (
          <div id="service-area">
            <ServiceAreaSection areas={geoAreas} />
          </div>
        )}

        {/* About */}
        {vis.about_section !== false && (
          <AboutSection text={contentSettings.aboutText} />
        )}

        {/* Testimonials */}
        {vis.testimonials !== false && (
          <TestimonialsSection testimonials={contentSettings.testimonials} />
        )}

        {/* FAQ */}
        {vis.faq_section !== false && (
          <FaqSection customFaqs={contentSettings.customFaq} />
        )}

        <PublicFooter />
      </main>

      {isDemo && <DemoBanner />}
    </>
  );
}

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { ProductCard } from "@/components/public/product-card";
import { TrustBar } from "@/components/public/trust-bar";
import { PainSection } from "@/components/public/pain-section";
import { BenefitsSection } from "@/components/public/benefits-section";
import { CategoryGrid } from "@/components/public/category-grid";
import { HowItWorks } from "@/components/public/how-it-works";
import { FeatureShowcase } from "@/components/public/feature-showcase";
import { IntegrationsBar } from "@/components/public/integrations-bar";
import { FaqSection } from "@/components/public/faq-section";
import { FinalCta } from "@/components/public/final-cta";
import { ServiceAreaSection } from "@/components/public/service-area-section";
import { PublicFooter } from "@/components/public/public-footer";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { JsonLdScript } from "@/components/seo/json-ld-script";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrganizationSettings();

  return buildPageMetadata({
    title: `${settings.businessName} Inflatable Rentals`,
    description: `${settings.websiteMessage} Serving ${settings.serviceAreaLabel}. Book bounce houses, water slides, and party rentals online.`,
    path: "/",
  });
}

export default async function HomePage() {
  const [featured, settings, geoAreas] = await Promise.all([
    getFeaturedCatalogList(),
    getOrganizationSettings(),
    getServiceAreasGeo(),
  ]);

  return (
    <>
      <PublicHeader />
      <JsonLdScript data={organizationJsonLd(settings)} />
      <JsonLdScript
        data={faqJsonLd([
          { question: "How does the booking process work?", answer: "Customers visit your storefront, pick a date and ZIP code, choose their rentals from your available inventory, and submit a booking request." },
          { question: "How do deposits and payments work?", answer: "You set your own deposit amounts and payment terms. The system tracks deposits, records payments, and shows remaining balances." },
          { question: "How do you prevent double-bookings?", answer: "Every confirmed order automatically blocks that product on that date. The availability engine checks for conflicts in real-time." },
          { question: "What about delivery and setup?", answer: "The platform includes delivery route management with stop-by-stop tracking and a mobile-friendly crew view." },
        ])}
      />

      <main>
        {/* Hero */}
        <section className="public-hero">
          <div className="public-hero-visual">
            <Image
              src="https://images.unsplash.com/photo-1633846764938-548112c2dcee?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=2400"
              alt="Colorful inflatable party rental setup"
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
                Inflatable rental software for growing businesses
              </div>

              <h1>
                Your Next Party,
                <br />
                Booked in Minutes
              </h1>

              <p>
                {settings.websiteMessage} Online booking, real-time
                availability, and automatic invoicing — serving{" "}
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
        <TrustBar />

        {/* Pain / before-after */}
        <PainSection />

        {/* Benefits / value props */}
        <BenefitsSection />

        {/* Category browsing */}
        <CategoryGrid />

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
        <div id="how-it-works">
          <HowItWorks />
        </div>

        {/* Feature showcase */}
        <FeatureShowcase />

        {/* Integrations */}
        <IntegrationsBar />

        {/* Service area */}
        <div id="service-area">
          <ServiceAreaSection areas={geoAreas} />
        </div>

        {/* FAQ */}
        <FaqSection />

        {/* Final CTA */}
        <FinalCta />

        <PublicFooter />
      </main>
    </>
  );
}

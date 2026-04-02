import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { ContactForm } from "@/components/public/contact-form";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrganizationSettings();
  return buildPageMetadata({
    title: `Contact Us — ${settings.businessName}`,
    description: `Get in touch with ${settings.businessName} for questions about rentals, bookings, or custom event packages.`,
    path: "/contact",
  });
}

export default async function ContactPage() {
  const settings = await getOrganizationSettings();

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 560 }}>
          <section className="panel" style={{ padding: "40px 36px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="kicker">Get in touch</div>
              <h1 style={{ margin: "8px 0 12px" }}>Contact Us</h1>
              <p className="muted">
                Have a question about rentals, pricing, or a custom event package?
                Send us a message and we&apos;ll get back to you within 24 hours.
              </p>
            </div>

            {(settings.phone || settings.supportEmail) && (
              <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "var(--surface-muted)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  Reach {settings.businessName} directly
                </div>
                {settings.phone && settings.phone !== "(555) 000-0000" && (
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    <span className="muted">Phone: </span>
                    <a href={`tel:${settings.phone}`} style={{ color: "var(--primary)", fontWeight: 500 }}>
                      {settings.phone}
                    </a>
                  </div>
                )}
                {settings.supportEmail && settings.supportEmail !== "hello@example.com" && (
                  <div style={{ fontSize: 14 }}>
                    <span className="muted">Email: </span>
                    <a href={`mailto:${settings.supportEmail}`} style={{ color: "var(--primary)", fontWeight: 500 }}>
                      {settings.supportEmail}
                    </a>
                  </div>
                )}
              </div>
            )}

            <ContactForm />
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

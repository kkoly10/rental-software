import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { ContactForm } from "@/components/public/contact-form";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrganizationSettings();
  return await buildPageMetadata({
    title: `Contact Us — ${settings.businessName}`,
    description: `Get in touch with ${settings.businessName} for questions about rentals, bookings, or custom event packages.`,
    path: "/contact",
    siteName: settings.businessName,
  });
}

export default async function ContactPage() {
  await requirePublicOrg();
  const [settings, m] = await Promise.all([getOrganizationSettings(), getMessages()]);

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 560 }}>
          <section className="panel" style={{ padding: "40px 36px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="kicker">{m.nav.contact}</div>
              <h1 style={{ margin: "8px 0 12px" }}>{m.contact.title}</h1>
              <p className="muted">
                {m.contact.description}
              </p>
            </div>

            {(settings.phone || settings.supportEmail) && (
              <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: "var(--surface-muted)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  {settings.businessName}
                </div>
                {settings.phone && settings.phone !== "(555) 000-0000" && (
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    <span className="muted">{m.common.phone}: </span>
                    <a href={`tel:${settings.phone}`} style={{ color: "var(--primary)", fontWeight: 500 }}>
                      {settings.phone}
                    </a>
                  </div>
                )}
                {settings.supportEmail && settings.supportEmail !== "hello@example.com" && (
                  <div style={{ fontSize: 14 }}>
                    <span className="muted">{m.common.email}: </span>
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

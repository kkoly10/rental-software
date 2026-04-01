import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { ContactForm } from "@/components/public/contact-form";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Us — Korent",
  description:
    "Get in touch with us for questions about rentals, bookings, or custom event packages.",
  path: "/contact",
});

export default function ContactPage() {
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

            <ContactForm />
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

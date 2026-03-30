import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service — RentalOS",
  description:
    "Terms and conditions governing use of the RentalOS rental management platform.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 760 }}>
          <section className="panel" style={{ padding: "40px 36px" }}>
            <div className="kicker">Legal</div>
            <h1 style={{ margin: "8px 0 24px" }}>Terms of Service</h1>
            <p className="muted" style={{ marginBottom: 8 }}>
              Last updated: March 30, 2026
            </p>

            <div className="legal-content">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing or using RentalOS (&quot;the Service&quot;), you agree to
                be bound by these Terms of Service. If you do not agree, do not
                use the Service.
              </p>

              <h2>2. Description of Service</h2>
              <p>
                RentalOS is a software-as-a-service platform that provides rental
                business management tools including online booking, order
                management, payment tracking, availability scheduling, document
                generation, and customer management.
              </p>

              <h2>3. Accounts</h2>
              <ul>
                <li>You must provide accurate, complete registration information.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>You must be at least 18 years old to create an operator account.</li>
                <li>One person or legal entity may maintain no more than one free account.</li>
              </ul>

              <h2>4. Subscription & Billing</h2>
              <ul>
                <li>The Service offers free and paid subscription tiers.</li>
                <li>Paid subscriptions are billed monthly or annually via Stripe.</li>
                <li>You may upgrade, downgrade, or cancel at any time from your billing settings.</li>
                <li>Cancellation takes effect at the end of the current billing period.</li>
                <li>Refunds are not provided for partial billing periods.</li>
              </ul>

              <h2>5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Upload malicious code, spam, or content that infringes intellectual property</li>
                <li>Attempt to gain unauthorized access to other accounts or systems</li>
                <li>Resell or redistribute the Service without written permission</li>
                <li>Exceed rate limits or abuse API endpoints</li>
              </ul>

              <h2>6. Your Data</h2>
              <p>
                You retain ownership of all data you enter into the Service. We
                do not claim intellectual property rights over your business data,
                customer records, or content. You grant us a limited license to
                host, process, and display your data solely to provide the Service.
              </p>

              <h2>7. Operator Responsibilities</h2>
              <p>
                As a rental business operator, you are responsible for:
              </p>
              <ul>
                <li>The accuracy of your product listings, pricing, and availability</li>
                <li>Compliance with local business licensing and insurance requirements</li>
                <li>Fulfilling bookings made through your storefront</li>
                <li>Your own cancellation and refund policies with your customers</li>
                <li>Obtaining necessary consent before entering customer personal data</li>
              </ul>

              <h2>8. Limitation of Liability</h2>
              <p>
                The Service is provided &quot;as is&quot; without warranties of any kind.
                RentalOS shall not be liable for any indirect, incidental,
                special, or consequential damages arising from your use of the
                Service. Our total liability shall not exceed the amount you paid
                for the Service in the 12 months preceding the claim.
              </p>

              <h2>9. Service Availability</h2>
              <p>
                We strive for high availability but do not guarantee uninterrupted
                access. Scheduled maintenance and updates may temporarily affect
                availability. We will provide reasonable notice for planned
                downtime.
              </p>

              <h2>10. Termination</h2>
              <p>
                We may suspend or terminate your account for violation of these
                Terms. You may delete your account at any time. Upon termination,
                your right to use the Service ceases and your data may be deleted
                after a reasonable retention period.
              </p>

              <h2>11. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms. Material changes will
                be communicated via email or in-app notification at least 30 days
                before taking effect. Continued use after changes constitutes
                acceptance.
              </p>

              <h2>12. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the Commonwealth of
                Virginia, United States, without regard to conflict of law
                principles.
              </p>

              <h2>13. Contact</h2>
              <p>
                For questions about these Terms, contact us at{" "}
                <strong>legal@rentalos.com</strong>.
              </p>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

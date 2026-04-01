import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy — Korent",
  description:
    "How Korent collects, uses, and protects your personal information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 760 }}>
          <section className="panel" style={{ padding: "40px 36px" }}>
            <div className="kicker">Legal</div>
            <h1 style={{ margin: "8px 0 24px" }}>Privacy Policy</h1>
            <p className="muted" style={{ marginBottom: 8 }}>
              Last updated: March 30, 2026
            </p>

            <div className="legal-content">
              <h2>1. Information We Collect</h2>
              <p>
                When you use Korent (&quot;the Service&quot;), we collect information
                you provide directly:
              </p>
              <ul>
                <li>
                  <strong>Account information:</strong> name, email address, phone
                  number, and business details when you create an operator account.
                </li>
                <li>
                  <strong>Customer data:</strong> names, email addresses, phone
                  numbers, and delivery addresses that operators enter for their
                  rental customers.
                </li>
                <li>
                  <strong>Payment information:</strong> payment records and
                  transaction details. Credit card processing is handled entirely
                  by Stripe — we never store card numbers.
                </li>
                <li>
                  <strong>Usage data:</strong> pages visited, features used, and
                  actions taken within the dashboard.
                </li>
              </ul>

              <h2>2. How We Use Your Information</h2>
              <p>We use collected information to:</p>
              <ul>
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send transactional emails (order confirmations, payment receipts, status updates)</li>
                <li>Respond to support requests and inquiries</li>
                <li>Enforce our Terms of Service and prevent abuse</li>
                <li>Send product updates and service announcements (with opt-out)</li>
              </ul>

              <h2>3. Data Sharing</h2>
              <p>
                We do not sell your personal information. We share data only with:
              </p>
              <ul>
                <li><strong>Stripe</strong> — for payment processing</li>
                <li><strong>Supabase</strong> — for database hosting and authentication</li>
                <li><strong>Resend</strong> — for transactional email delivery</li>
                <li><strong>Vercel</strong> — for application hosting</li>
              </ul>
              <p>
                Each provider processes data under their own privacy policies and
                in compliance with applicable regulations.
              </p>

              <h2>4. Data Security</h2>
              <p>
                We implement industry-standard security measures including
                encrypted connections (TLS), row-level security policies on all
                database tables, rate limiting on authentication endpoints, and
                secure session management.
              </p>

              <h2>5. Data Retention</h2>
              <p>
                We retain account and business data for as long as your account is
                active. Customer records entered by operators are retained per the
                operator&apos;s use of the platform. You may request deletion of your
                account and associated data at any time by contacting us.
              </p>

              <h2>6. Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Export your data (CSV export available in-app)</li>
                <li>Opt out of non-essential communications</li>
              </ul>

              <h2>7. Cookies</h2>
              <p>
                We use essential cookies for authentication and session management.
                We do not use third-party tracking cookies or advertising cookies.
              </p>

              <h2>8. Children&apos;s Privacy</h2>
              <p>
                The Service is intended for business operators aged 18 and older.
                We do not knowingly collect information from children under 13.
              </p>

              <h2>9. Changes to This Policy</h2>
              <p>
                We may update this policy periodically. Material changes will be
                communicated via email or in-app notification. Continued use of the
                Service after changes constitutes acceptance.
              </p>

              <h2>10. Contact</h2>
              <p>
                For privacy-related questions or data requests, contact us at{" "}
                <strong>privacy@korent.io</strong>.
              </p>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

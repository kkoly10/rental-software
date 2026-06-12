import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return await buildPageMetadata({
    title: "Privacy Policy — Korent",
    description:
      "How Korent collects, uses, and protects your personal information.",
    path: "/privacy",
  });
}

export default async function PrivacyPage() {
  if (await isTenantHost()) notFound();
  const m = await getMessages();

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 760 }}>
          <section className="panel" style={{ padding: "40px 36px" }}>
            <div className="kicker">{m.footer.columns.legal}</div>
            <h1 style={{ margin: "8px 0 24px" }}>{m.legal.privacy.title}</h1>
            <p className="muted" style={{ marginBottom: 8 }}>
              {m.legal.privacy.lastUpdated}: June 12, 2026
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
                <li>
                  <strong>Marketplace data (Korent Marketplace at
                  rent.korent.app):</strong> renter identity-verification
                  photos (a government ID photo and a live selfie — see
                  section 2a), verified phone numbers, messages between
                  renters and sellers (screened by automated moderation),
                  booking and payment records, item condition photos uploaded
                  at handoff and return, reviews, and demand requests
                  (searches and waitlist signups, including email).
                </li>
              </ul>

              <h2>2a. Identity Verification Photos</h2>
              <p>
                To make in-person handoffs safer, renters upload a government
                ID photo and a live selfie before booking. These images are
                stored in a private bucket and are viewable only by (a) the
                seller at handoff through short-lived links so they can
                visually confirm you are you, and (b) Korent personnel when a
                dispute requires it. <strong>A human compares the photos. We
                do not use facial recognition and do not create biometric
                templates, faceprints, or scans of face geometry — from these
                images or any others.</strong> Verification photos are
                retained while your account is active because they are used
                at each rental handoff, and are deleted within 30 days of an
                account-deletion request.
              </p>

              <h2>2. How We Use Your Information</h2>
              <p>We use collected information to:</p>
              <ul>
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send transactional emails (order confirmations, payment receipts, status updates)</li>
                <li>Respond to support requests and inquiries</li>
                <li>Enforce our Terms of Service and prevent abuse</li>
                <li>Send product updates and service announcements (with opt-out)</li>
                <li>
                  Send text messages for verification codes and rental
                  notifications when you provide your phone number (reply
                  STOP to opt out; we do not send marketing texts)
                </li>
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
                <li>
                  <strong>Anthropic</strong> — listing text (titles and
                  descriptions) may be processed by an AI model to keep
                  listings correctly categorized; no personal data, photos,
                  or messages are sent
                </li>
              </ul>
              <p>
                Identity-verification photos are shared with no one beyond
                the handoff and dispute uses described in section 2a.
              </p>
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
                operator&apos;s use of the platform. Marketplace booking records,
                evidence photos, and dispute records are retained for as long as
                needed to administer rentals, resolve disputes, and meet tax and
                legal obligations. Identity-verification photos follow the rule in
                section 2a. You may request deletion of your account and associated
                data at any time by contacting us.
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
                <strong>privacy@korent.app</strong>.
              </p>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

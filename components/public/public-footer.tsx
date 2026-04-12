import Link from "next/link";
import { getOrganizationSettings } from "@/lib/data/organization-settings";

export async function PublicFooter() {
  const year = new Date().getFullYear();
  const settings = await getOrganizationSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const hasPhone = settings.phone && settings.phone !== "(555) 000-0000";
  const hasEmail = settings.supportEmail && settings.supportEmail !== "hello@example.com";
  const hasSocial =
    settings.socialFacebook ||
    settings.socialInstagram ||
    settings.socialTiktok ||
    settings.socialGoogleBusiness;

  return (
    <footer className="footer">
      <div className="container">
        <div className="panel" style={{ padding: 28 }}>
          <div className="footer-grid">
            <div>
              <div className="kicker" style={{ marginBottom: 10 }}>{settings.businessName}</div>
              <div className="muted" style={{ lineHeight: 1.65, maxWidth: 260 }}>
                Clean, safe, professionally delivered inflatable rentals for birthdays, school events, and church gatherings.
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  Serving {settings.serviceAreaLabel}
                </div>
              </div>

              {hasSocial && (
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  {settings.socialFacebook && (
                    <a href={settings.socialFacebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={{ color: "var(--text-soft)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                  )}
                  {settings.socialInstagram && (
                    <a href={settings.socialInstagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ color: "var(--text-soft)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </a>
                  )}
                  {settings.socialTiktok && (
                    <a href={settings.socialTiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" style={{ color: "var(--text-soft)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.15a8.16 8.16 0 005.58 2.2V11.3a4.85 4.85 0 01-3.77-1.84V6.69h3.77z"/></svg>
                    </a>
                  )}
                  {settings.socialGoogleBusiness && (
                    <a href={settings.socialGoogleBusiness} target="_blank" rel="noopener noreferrer" aria-label="Google Business" style={{ color: "var(--text-soft)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                    </a>
                  )}
                </div>
              )}
            </div>

            <div>
              <strong style={{ fontSize: 13 }}>Browse</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <Link href="/inventory" className="muted">Full Catalog</Link>
                <Link href="/inventory?category=bounce-houses" className="muted">Bounce Houses</Link>
                <Link href="/inventory?category=water-slides" className="muted">Water Slides</Link>
                <Link href="/inventory?category=packages" className="muted">Party Packages</Link>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: 13 }}>Company</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <a href="#how-it-works" className="muted">How It Works</a>
                <Link href="/pricing" className="muted">Pricing</Link>
                <Link href="/order-status" className="muted">Order Status</Link>
                <Link href="/contact" className="muted">Contact Us</Link>
                <a href="#service-area" className="muted">Service Area</a>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: 13 }}>For Operators</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <a href={`${siteUrl}/signup`} className="muted">Create Account</a>
                <a href={`${siteUrl}/login`} className="muted">Operator Login</a>
                <Link href="/pricing" className="muted">Plans & Pricing</Link>
              </div>

              {(hasPhone || hasEmail) && (
                <>
                  <strong style={{ fontSize: 13, marginTop: 16, display: "block" }}>Contact</strong>
                  <div className="list" style={{ marginTop: 10 }}>
                    {hasPhone && (
                      <a href={`tel:${settings.phone}`} className="muted">{settings.phone}</a>
                    )}
                    {hasEmail && (
                      <a href={`mailto:${settings.supportEmail}`} className="muted">{settings.supportEmail}</a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="footer-bottom">
            <div className="muted" style={{ fontSize: 12 }}>
              &copy; {year} {settings.businessName}. All rights reserved.
            </div>
            <div className="footer-bottom-links">
              <Link href="/privacy" className="muted" style={{ fontSize: 12 }}>Privacy</Link>
              <Link href="/terms" className="muted" style={{ fontSize: 12 }}>Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

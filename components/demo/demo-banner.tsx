"use client";

import { useI18n } from "@/lib/i18n/provider";

/**
 * Sticky banner shown on demo storefront pages.
 * Drives visitors to sign up for their own storefront.
 */
export function DemoBanner() {
  const { messages: m } = useI18n();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const signupUrl = siteUrl
    ? `${siteUrl}/signup`
    : `https://${appDomain}/signup`;

  return (
    <div className="demo-storefront-banner" role="complementary">
      <span className="demo-storefront-banner-text">
        {m.demoBanner.poweredBy} <strong>{m.common.appName}</strong>.
      </span>
      <a href={signupUrl} className="demo-storefront-banner-cta">
        {m.demoBanner.createOwn}
      </a>
    </div>
  );
}

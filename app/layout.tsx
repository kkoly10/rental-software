import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getSiteBaseUrl } from "@/lib/seo/metadata";
import { getBrandSettings } from "@/lib/data/brand";
import { BrandStyleInjector } from "@/components/layout/brand-style-injector";
import { RegisterSW } from "@/components/pwa/register-sw";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { ProductionEnvGuard } from "@/components/layout/production-env-guard";
import { isTenantHost } from "@/lib/auth/org-context";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e5dcf",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: "Korent",
  description:
    "Korent is an inflatable-first rental software platform with a public storefront, operator dashboard, and crew workflow support.",
  applicationName: "Korent",
  manifest: "/manifest.json",
  keywords: [
    "rental software",
    "party rental software",
    "inflatable rental software",
    "bounce house booking",
    "equipment rental platform",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Korent",
  },
  openGraph: {
    title: "Korent",
    description:
      "Inflatable-first rental software with storefront, operations dashboard, and crew workflows.",
    siteName: "Korent",
    type: "website",
    url: getSiteBaseUrl(),
  },
  twitter: {
    card: "summary",
    title: "Korent",
    description:
      "Inflatable-first rental software with storefront, operations dashboard, and crew workflows.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only inject tenant brand styles on tenant subdomains/custom domains.
  // The SaaS marketing page (root domain) must never be affected by
  // individual tenant brand overrides.
  const tenantHost = await isTenantHost();
  const brand = tenantHost ? await getBrandSettings() : null;

  return (
    <html lang="en">
      <body>
        {brand && <BrandStyleInjector brand={brand} />}
        <RegisterSW />
        <ProductionEnvGuard>
          <DemoModeBanner />
          {children}
        </ProductionEnvGuard>
      </body>
    </html>
  );
}
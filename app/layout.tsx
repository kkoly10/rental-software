import "./globals.css";
import "leaflet/dist/leaflet.css";
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
  themeColor: "#e8590c",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: "Korent",
  description:
    "Korent is a rental software platform with a public storefront, operator dashboard, and crew workflow support.",
  applicationName: "Korent",
  manifest: "/manifest.json",
  keywords: [
    "rental software",
    "party rental software",
    "equipment rental software",
    "online rental booking",
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
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Korent" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Korent",
    description:
      "Inflatable-first rental software with storefront, operations dashboard, and crew workflows.",
    images: ["/og-image.png"],
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
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
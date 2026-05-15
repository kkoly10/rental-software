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
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e8590c",
};

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await isTenantHost();

  const icons: Metadata["icons"] = {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  };

  if (!tenant) {
    const base = getSiteBaseUrl();
    return {
      metadataBase: new URL(base),
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
      icons,
      appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Korent",
      },
      openGraph: {
        title: "Korent",
        description:
          "Rental software with storefront, operations dashboard, and crew workflows.",
        siteName: "Korent",
        type: "website",
        url: base,
        images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Korent" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Korent",
        description:
          "Rental software with storefront, operations dashboard, and crew workflows.",
        images: ["/og-image.png"],
      },
    };
  }

  // Tenant subdomain / custom domain — brand with the operator's business name.
  const settings = await getOrganizationSettings();
  const businessName = settings.businessName || "Rentals";

  return {
    metadataBase: new URL(getSiteBaseUrl()),
    title: businessName,
    description: `${businessName} — book rentals online with real-time availability.`,
    applicationName: businessName,
    manifest: "/manifest.webmanifest",
    icons,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: businessName,
    },
    openGraph: {
      title: businessName,
      description: `${businessName} — book rentals online with real-time availability.`,
      siteName: businessName,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: businessName,
    },
  };
}

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
  const locale = await getLocale();

  return (
    <html lang={locale}>
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
        <I18nProvider locale={locale}>
          <ProductionEnvGuard>
            <DemoModeBanner />
            {children}
          </ProductionEnvGuard>
        </I18nProvider>
      </body>
    </html>
  );
}

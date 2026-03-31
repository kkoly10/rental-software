import "./globals.css";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/seo/metadata";
import { getBrandSettings } from "@/lib/data/brand";
import { BrandStyleInjector } from "@/components/layout/brand-style-injector";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: "RentalOS",
  description:
    "RentalOS is an inflatable-first rental software platform with a public storefront, operator dashboard, and crew workflow support.",
  applicationName: "RentalOS",
  keywords: [
    "rental software",
    "party rental software",
    "inflatable rental software",
    "bounce house booking",
    "equipment rental platform",
  ],
  openGraph: {
    title: "RentalOS",
    description:
      "Inflatable-first rental software with storefront, operations dashboard, and crew workflows.",
    siteName: "RentalOS",
    type: "website",
    url: getSiteBaseUrl(),
  },
  twitter: {
    card: "summary",
    title: "RentalOS",
    description:
      "Inflatable-first rental software with storefront, operations dashboard, and crew workflows.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = await getBrandSettings();

  return (
    <html lang="en">
      <body>
        <BrandStyleInjector brand={brand} />
        {children}
      </body>
    </html>
  );
}
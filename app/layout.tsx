import "./globals.css";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/seo/metadata";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
import { ImageResponse } from "next/og";
import { isTenantHost } from "@/lib/auth/org-context";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getBrandSettings } from "@/lib/data/brand";

export const alt = "Rental booking storefront";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const KORENT_GRADIENT = "linear-gradient(135deg, #1b2554 0%, #1e5dcf 100%)";

function gradientFor(primary: string): string {
  if (!primary || !/^#[0-9a-fA-F]{6}$/.test(primary)) return KORENT_GRADIENT;
  return `linear-gradient(135deg, ${primary} 0%, ${primary}cc 100%)`;
}

export default async function OgImage() {
  const tenant = await isTenantHost();

  if (!tenant) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: KORENT_GRADIENT,
            color: "white",
            fontFamily: "system-ui, sans-serif",
            padding: "60px",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: 0.7,
              marginBottom: 16,
            }}
          >
            Korent
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.1,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Rental Business Software
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              opacity: 0.8,
              textAlign: "center",
              maxWidth: 700,
            }}
          >
            Online booking, real-time availability, and automatic invoicing for rental businesses
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const [settings, brand] = await Promise.all([
    getOrganizationSettings(),
    getBrandSettings(),
  ]);

  const businessName = settings.businessName || "Rentals";
  const tagline =
    settings.websiteMessage ||
    settings.heroHeadline ||
    "Online booking, real-time availability, and easy delivery scheduling.";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: gradientFor(brand.primaryColor),
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.1,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {businessName}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            opacity: 0.9,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.35,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}

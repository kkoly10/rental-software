import type { MetadataRoute } from "next";
import { isTenantHost } from "@/lib/auth/org-context";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getBrandSettings } from "@/lib/data/brand";

const icons: MetadataRoute.Manifest["icons"] = [
  { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
  {
    src: "/icon-maskable-512x512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
  { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = await isTenantHost();

  if (!tenant) {
    return {
      name: "Korent — Rental Business Software",
      short_name: "Korent",
      description: "Run your rental business from anywhere",
      start_url: "/dashboard",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#e8590c",
      orientation: "any",
      categories: ["business", "productivity"],
      icons,
    };
  }

  const [settings, brand] = await Promise.all([
    getOrganizationSettings(),
    getBrandSettings(),
  ]);

  const name = settings.businessName || "Rental Business";
  // Allow only the valid hex lengths (3/4/6/8); the previous {3,8} range
  // accepted invalid 5/7-char hex values.
  const themeColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(brand.primaryColor)
    ? brand.primaryColor
    : "#e8590c";

  return {
    name,
    short_name: name.split(" ").slice(0, 2).join(" "),
    description: `Book rentals from ${name} online.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColor,
    orientation: "any",
    categories: ["shopping", "local"],
    icons,
  };
}

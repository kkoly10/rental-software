import type { Metadata } from "next";

function normalizeBaseUrl(value?: string | null) {
  if (!value) return "http://localhost:3000";

  const trimmed = value.trim();
  if (!trimmed) return "http://localhost:3000";

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  return withProtocol.endsWith("/")
    ? withProtocol.slice(0, -1)
    : withProtocol;
}

export function getSiteBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      process.env.VERCEL_URL
  );
}

export function getCanonicalUrl(path = "/") {
  const base = getSiteBaseUrl();
  return path === "/" ? base : `${base}${path}`;
}

export function buildPageMetadata(options: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}) {
  const canonical = getCanonicalUrl(options.path ?? "/");

  const metadata: Metadata = {
    title: options.title,
    description: options.description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: options.title,
      description: options.description,
      url: canonical,
      siteName: "Korent",
      type: "website",
      images: options.image ? [{ url: options.image }] : undefined,
    },
    twitter: {
      card: options.image ? "summary_large_image" : "summary",
      title: options.title,
      description: options.description,
      images: options.image ? [options.image] : undefined,
    },
  };

  if (options.noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  return metadata;
}
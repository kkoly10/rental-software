import type { Metadata } from "next";
import { headers } from "next/headers";
import { isTenantHost } from "@/lib/auth/org-context";

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

/**
 * Resolve the absolute origin (proto://host) for the current incoming request.
 * Use this instead of `getSiteBaseUrl()` whenever the URL must reflect the
 * tenant subdomain or custom domain the visitor is actually on (canonical
 * tags, sitemap, robots, Stripe redirect URLs, etc.).
 */
export async function getRequestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() is unavailable at build time — fall back to the static base.
  }
  return getSiteBaseUrl();
}

export function getCanonicalUrl(path = "/", base?: string) {
  const root = base ?? getSiteBaseUrl();
  return path === "/" ? root : `${root}${path}`;
}

export async function getRequestCanonicalUrl(path = "/") {
  const origin = await getRequestOrigin();
  return getCanonicalUrl(path, origin);
}

export async function buildPageMetadata(options: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  siteName?: string;
}): Promise<Metadata> {
  const canonical = await getRequestCanonicalUrl(options.path ?? "/");

  // Only fall back to "Korent" on the marketing/dashboard root domain.
  // On tenant hosts (subdomain or custom domain) we omit siteName entirely
  // rather than leak the operator's brand into Korent's.
  let resolvedSiteName: string | undefined = options.siteName;
  if (!resolvedSiteName) {
    const tenant = await isTenantHost();
    resolvedSiteName = tenant ? undefined : "Korent";
  }

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
      siteName: resolvedSiteName,
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

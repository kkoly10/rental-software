import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

// Builds the CSP directive list. `frameAncestors` defaults to 'none' (the global
// policy — the app refuses to be framed anywhere). The builder preview route
// (PR-1f) is the ONLY exception: it overrides ONLY this one directive to 'self'
// so the same-origin builder iframe can embed it. Every other directive — and
// every other route — is unchanged.
function buildCsp(frameAncestors: "'none'" | "'self'" = "'none'") {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
    "font-src 'self' data: https:",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://cdn.pixabay.com https://images.pexels.com https://*.tile.openstreetmap.org",
    `connect-src 'self' ${process.env.NEXT_PUBLIC_SITE_URL ?? ""} https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "form-action 'self' https://checkout.stripe.com",
  ];

  if (isProd) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

// The builder preview route — the SINGLE path allowed to be framed (same-origin
// only). Kept as a constant so the scoped headers() entry below and the global
// negative-lookahead that excludes it from the DENY/'none' policy can't drift.
const PREVIEW_ROUTE = "/dashboard/website/builder/preview";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Client router cache: keep visited dynamic pages (the dashboard is
    // fully dynamic) reusable for 30s, so tab switches render instantly
    // instead of re-fetching the whole RSC payload — operators reported
    // a multi-second "Loading…" on every single navigation. Mutations
    // still bust this via revalidatePath, and 30s-stale list data is an
    // acceptable trade for snappy navigation.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },

  async headers() {
    // Shared security headers (non-frame-related) applied to EVERY route,
    // including the preview route — only the frame policy differs there.
    const commonSecurityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
    ];

    return [
      {
        // SCOPED override (PR-1f): the builder preview route is the ONLY path
        // allowed to be framed, and only by the same origin (the builder iframe).
        // Same CSP as everywhere else, with ONLY frame-ancestors flipped to
        // 'self', plus X-Frame-Options: SAMEORIGIN. Listed first; the global
        // rule below excludes this exact path via negative lookahead so the two
        // can't both set a (conflicting) frame policy on it.
        source: PREVIEW_ROUTE,
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp("'self'"),
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          ...commonSecurityHeaders,
        ],
      },
      {
        // Global policy — UNCHANGED for every route EXCEPT the preview path,
        // which is excluded via negative lookahead so it keeps its own
        // SAMEORIGIN/'self' frame policy above. Every other route still gets
        // X-Frame-Options: DENY and frame-ancestors 'none', byte-for-byte as
        // before.
        source:
          "/((?!dashboard/website/builder/preview$).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp(),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          ...commonSecurityHeaders,
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: !process.env.NEXT_PUBLIC_SENTRY_DSN },
  telemetry: false,
});

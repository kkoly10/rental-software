import { getAppDomain } from "@/lib/auth/resolve-org";

export type StorefrontDomainSettings = {
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
};

/**
 * Build the public storefront URL for a tenant.
 *
 * Pass `requestHost` from server-side request headers so that local dev
 * (localhost / 127.0.0.1) resolves to the root URL instead of a
 * subdomain that can't be resolved without DNS/Vercel wildcard config.
 */
export function buildStorefrontUrl(
  settings: StorefrontDomainSettings,
  requestHost?: string,
): string | null {
  if (settings.customDomain && settings.customDomainVerified) {
    return `https://${settings.customDomain}`;
  }

  // On localhost, subdomain routing doesn't work — storefront is the root page
  if (requestHost) {
    const bare = requestHost.split(":")[0];
    if (bare === "localhost" || bare === "127.0.0.1") {
      return `http://${requestHost}`;
    }
  }

  if (!settings.slug) return null;

  return `https://${settings.slug}.${getAppDomain()}`;
}


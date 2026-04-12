import { getAppDomain } from "@/lib/auth/resolve-org";

export type StorefrontDomainSettings = {
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
};

export function buildStorefrontUrl(settings: StorefrontDomainSettings): string {
  if (settings.customDomain && settings.customDomainVerified) {
    return `https://${settings.customDomain}`;
  }

  return `https://${settings.slug}.${getAppDomain()}`;
}


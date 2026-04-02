import { hasSupabaseEnv } from "@/lib/env";
import { getPublicOrgId, getOrgContext } from "@/lib/auth/org-context";
import { checkProductAvailability } from "@/lib/availability/check";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import type { CatalogProduct } from "@/lib/types";

export type CatalogAvailabilityResult = {
  products: CatalogProduct[];
  zipValid: boolean | null; // null = no zip provided
  zipMessage?: string;
};

/**
 * Enrich a catalog product list with real-time availability for a given date,
 * and validate the delivery ZIP against service areas.
 */
export async function enrichCatalogAvailability(
  products: CatalogProduct[],
  date?: string,
  zip?: string
): Promise<CatalogAvailabilityResult> {
  if (!hasSupabaseEnv()) {
    return { products, zipValid: null };
  }

  const ctx = await getOrgContext();
  const organizationId = ctx?.organizationId ?? (await getPublicOrgId());
  if (!organizationId) {
    return { products, zipValid: null };
  }

  // Check ZIP against service areas
  let zipValid: boolean | null = null;
  let zipMessage: string | undefined;

  if (zip) {
    const serviceArea = await resolveServiceAreaForAddress({
      organizationId,
      postalCode: zip,
    });
    zipValid = !!serviceArea;
    if (!serviceArea) {
      zipMessage = `Delivery not available to ${zip}. Contact us for options.`;
    }
  }

  // Check availability for each product on the given date
  if (!date) {
    return { products, zipValid, zipMessage };
  }

  const enriched = await Promise.all(
    products.map(async (product) => {
      const result = await checkProductAvailability({
        organizationId,
        productId: product.id,
        eventDate: date,
      });

      if (!result.available) {
        return {
          ...product,
          status: `Unavailable on ${date}`,
        };
      }

      return product;
    })
  );

  return { products: enriched, zipValid, zipMessage };
}

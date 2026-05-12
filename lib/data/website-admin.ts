import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getCatalogList } from "@/lib/data/catalog-list";
import { getServiceAreas } from "@/lib/data/service-areas";

export async function getWebsiteAdminData() {
  const [settings, products, serviceAreas] = await Promise.all([
    getOrganizationSettings(),
    getCatalogList(),
    getServiceAreas(),
  ]);

  return {
    settings,
    featuredProducts: products.slice(0, 4),
    serviceAreas: serviceAreas.slice(0, 3),
  };
}

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";
import { normalizePostalCode } from "@/lib/service-areas/normalize";

export type ServiceAreaGeo = {
  id: string;
  label: string;
  zipCode: string;
  city?: string;
  state?: string;
  deliveryFee: number;
  minimumOrder: number;
};

const fallbackGeoAreas: ServiceAreaGeo[] = [
  {
    id: "area_1",
    label: "Primary local coverage",
    zipCode: "22554",
    city: "Stafford",
    state: "VA",
    deliveryFee: 20,
    minimumOrder: 125,
  },
  {
    id: "area_2",
    label: "Extended coverage",
    zipCode: "22401",
    city: "Fredericksburg",
    state: "VA",
    deliveryFee: 35,
    minimumOrder: 175,
  },
  {
    id: "area_3",
    label: "Regional delivery zone",
    zipCode: "22556",
    city: "Stafford",
    state: "VA",
    deliveryFee: 55,
    minimumOrder: 250,
  },
];

export async function getServiceAreasGeo(): Promise<ServiceAreaGeo[]> {
  if (!hasSupabaseEnv()) {
    return fallbackGeoAreas;
  }

  const ctx = await getOrgContext();
  const organizationId = ctx?.organizationId ?? (await getPublicOrgId());
  if (!organizationId) return fallbackGeoAreas;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select(
      "id, label, zip_code, postal_codes, city, state, delivery_fee, minimum_order_amount, is_active"
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (error || !data || data.length === 0) {
    return fallbackGeoAreas;
  }

  return data.map((area) => {
    const postalCodes =
      Array.isArray(area.postal_codes) && area.postal_codes.length > 0
        ? area.postal_codes
            .map((value) => normalizePostalCode(String(value)))
            .filter(Boolean)
        : area.zip_code
        ? [normalizePostalCode(area.zip_code)]
        : [];

    return {
      id: area.id,
      label: area.label ?? "Service Area",
      zipCode: postalCodes[0] || "",
      city: area.city ?? undefined,
      state: area.state ?? undefined,
      deliveryFee: Number(area.delivery_fee ?? 0),
      minimumOrder: Number(area.minimum_order_amount ?? 0),
    };
  });
}

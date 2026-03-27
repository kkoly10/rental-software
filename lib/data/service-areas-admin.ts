import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { normalizePostalCode } from "@/lib/service-areas/normalize";

export type ServiceAreaAdminRecord = {
  id: string;
  label: string;
  primaryPostalCode: string;
  postalCodesText: string;
  city: string;
  state: string;
  deliveryFee: number;
  minimumOrderAmount: number;
  isActive: boolean;
};

const fallbackAreas: ServiceAreaAdminRecord[] = [
  {
    id: "area_1",
    label: "Primary local coverage",
    primaryPostalCode: "22554",
    postalCodesText: "22554\n22556\n22401",
    city: "Stafford",
    state: "VA",
    deliveryFee: 20,
    minimumOrderAmount: 125,
    isActive: true,
  },
];

export async function getServiceAreaAdminRecords(): Promise<ServiceAreaAdminRecord[]> {
  if (!hasSupabaseEnv()) {
    return fallbackAreas;
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return fallbackAreas;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select(
      "id, label, zip_code, postal_codes, city, state, delivery_fee, minimum_order_amount, is_active, deleted_at"
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("label", { ascending: true });

  if (error || !data) {
    return fallbackAreas;
  }

  return data.map((area) => {
    const postalCodes =
      Array.isArray(area.postal_codes) && area.postal_codes.length > 0
        ? area.postal_codes.map((value) => normalizePostalCode(String(value))).filter(Boolean)
        : area.zip_code
        ? [normalizePostalCode(area.zip_code)]
        : [];

    return {
      id: area.id,
      label: area.label ?? "Service Area",
      primaryPostalCode: normalizePostalCode(area.zip_code) || postalCodes[0] || "",
      postalCodesText: postalCodes.join("\n"),
      city: area.city ?? "",
      state: area.state ?? "",
      deliveryFee: Number(area.delivery_fee ?? 0),
      minimumOrderAmount: Number(area.minimum_order_amount ?? 0),
      isActive: area.is_active ?? true,
    };
  });
}

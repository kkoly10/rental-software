import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeCity,
  normalizePostalCode,
  normalizeState,
} from "@/lib/service-areas/normalize";

export type ResolvedServiceArea = {
  id: string;
  label: string;
  postalCode: string | null;
  deliveryFee: number;
  minimumOrderAmount: number;
};

export async function resolveServiceAreaForAddress(options: {
  organizationId: string;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<ResolvedServiceArea | null> {
  const supabase = await createSupabaseServerClient();
  const normalizedPostalCode = normalizePostalCode(options.postalCode);
  const normalizedCity = normalizeCity(options.city);
  const normalizedState = normalizeState(options.state);

  const { data, error } = await supabase
    .from("service_areas")
    .select(
      "id, label, zip_code, city, state, delivery_fee, minimum_order_amount, is_active, postal_codes"
    )
    .eq("organization_id", options.organizationId)
    .eq("is_active", true);

  if (error || !data || data.length === 0) {
    return null;
  }

  const exactPostalMatch = data.find((area) => {
    const primaryPostal = normalizePostalCode(area.zip_code);
    const alternatePostals = Array.isArray(area.postal_codes)
      ? area.postal_codes.map((value) => normalizePostalCode(String(value)))
      : [];

    return Boolean(normalizedPostalCode) && (
      primaryPostal === normalizedPostalCode ||
      alternatePostals.includes(normalizedPostalCode)
    );
  });

  if (exactPostalMatch) {
    return mapServiceArea(exactPostalMatch);
  }

  const cityStateMatch = data.find((area) => {
    const areaCity = normalizeCity(area.city);
    const areaState = normalizeState(area.state);

    return Boolean(normalizedCity) && Boolean(normalizedState) && areaCity === normalizedCity && areaState === normalizedState;
  });

  if (cityStateMatch) {
    return mapServiceArea(cityStateMatch);
  }

  return null;
}

function mapServiceArea(area: {
  id: string;
  label: string | null;
  zip_code: string | null;
  delivery_fee: number | string | null;
  minimum_order_amount: number | string | null;
}) {
  return {
    id: area.id,
    label: area.label || "Service Area",
    postalCode: area.zip_code,
    deliveryFee: Number(area.delivery_fee ?? 0),
    minimumOrderAmount: Number(area.minimum_order_amount ?? 0),
  } satisfies ResolvedServiceArea;
}

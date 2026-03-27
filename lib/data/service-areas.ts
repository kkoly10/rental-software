import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { normalizePostalCode } from "@/lib/service-areas/normalize";
import type { ServiceAreaSummary } from "@/lib/types";

const fallbackAreas: ServiceAreaSummary[] = [
  {
    id: "area_1",
    name: "Primary local coverage — 3 ZIPs",
    fee: "$20",
    minimum: "$125 minimum",
  },
  {
    id: "area_2",
    name: "Extended coverage — 5 ZIPs",
    fee: "$35",
    minimum: "$175 minimum",
  },
  {
    id: "area_3",
    name: "Regional delivery zone",
    fee: "$55",
    minimum: "$250 minimum",
  },
];

function formatCoverage(area: {
  zip_code?: string | null;
  postal_codes?: string[] | null;
  city?: string | null;
  state?: string | null;
}) {
  const postalCodes =
    Array.isArray(area.postal_codes) && area.postal_codes.length > 0
      ? area.postal_codes
          .map((value) => normalizePostalCode(String(value)))
          .filter(Boolean)
      : area.zip_code
      ? [normalizePostalCode(area.zip_code)]
      : [];

  const location = [area.city, area.state].filter(Boolean).join(", ");
  const postalLabel =
    postalCodes.length > 0
      ? postalCodes.length === 1
        ? postalCodes[0]
        : `${postalCodes.length} ZIPs`
      : "";

  return [postalLabel, location].filter(Boolean).join(" • ");
}

export async function getServiceAreas(): Promise<ServiceAreaSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackAreas;
  }

  const ctx = await getOrgContext();
  if (!ctx) return fallbackAreas;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select(
      "id, label, zip_code, postal_codes, city, state, delivery_fee, minimum_order_amount, is_active"
    )
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (error || !data || data.length === 0) {
    return fallbackAreas;
  }

  return data.map((area) => {
    const coverage = formatCoverage(area);

    return {
      id: area.id,
      name:
        [area.label || "Service Area", coverage].filter(Boolean).join(" — ") ||
        "Service Area",
      fee:
        typeof area.delivery_fee === "number"
          ? `$${area.delivery_fee}`
          : "$0",
      minimum:
        typeof area.minimum_order_amount === "number"
          ? `$${area.minimum_order_amount} minimum`
          : "$0 minimum",
    };
  });
}
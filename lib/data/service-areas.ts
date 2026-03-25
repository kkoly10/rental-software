import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceAreaSummary } from "@/lib/types";

const fallbackAreas: ServiceAreaSummary[] = [
  { id: "area_1", name: "Stafford 22554", fee: "$20", minimum: "$125 minimum" },
  { id: "area_2", name: "Fredericksburg 22401", fee: "$30", minimum: "$150 minimum" },
  { id: "area_3", name: "Northern Virginia zone", fee: "$55", minimum: "$250 minimum" },
];

export async function getServiceAreas(): Promise<ServiceAreaSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackAreas;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select("id, label, zip_code, delivery_fee, minimum_order_amount, is_active")
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (error || !data || data.length === 0) {
    return fallbackAreas;
  }

  return data.map((area) => ({
    id: area.id,
    name: [area.label, area.zip_code].filter(Boolean).join(" ") || "Service Area",
    fee: typeof area.delivery_fee === "number" ? `$${area.delivery_fee}` : "$0",
    minimum: typeof area.minimum_order_amount === "number" ? `$${area.minimum_order_amount} minimum` : "$0 minimum",
  }));
}

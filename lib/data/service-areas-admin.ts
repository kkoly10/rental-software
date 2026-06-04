import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  normalizePostalCode,
  normalizeCity,
  normalizeState,
} from "@/lib/service-areas/normalize";

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

/**
 * A pair of service areas whose coverage overlaps. Surfacing these on the
 * service-areas dashboard helps the operator clean up duplicates that would
 * otherwise cause `resolveServiceAreaForAddress` to pick one arbitrarily.
 * The lookup itself uses a deterministic tie-breaker (most-recently-updated)
 * but the operator still needs to see the warning to fix the root cause.
 */
export type ServiceAreaOverlap = {
  kind: "city_state" | "postal_code";
  label: string;
  areaIds: string[];
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
    return [];
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

  if (error) {
    console.error("[service-areas-admin] Query failed:", error.message);
    return [];
  }

  if (!data) {
    return [];
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

/**
 * Detect pairs of active service areas with overlapping coverage. Two flavours:
 *   - `city_state` — both records share the same (city, state) tuple.
 *   - `postal_code` — both records list the same ZIP in either primary or
 *     alternates.
 * Only active records are considered, since archived areas no longer affect
 * the lookup.
 */
export function findServiceAreaOverlaps(
  records: ServiceAreaAdminRecord[]
): ServiceAreaOverlap[] {
  const active = records.filter((r) => r.isActive);
  const overlaps: ServiceAreaOverlap[] = [];

  // city + state collisions
  const cityStateGroups = new Map<string, string[]>();
  for (const r of active) {
    const c = normalizeCity(r.city);
    const s = normalizeState(r.state);
    if (!c || !s) continue;
    const key = `${c}|${s}`;
    const existing = cityStateGroups.get(key) ?? [];
    existing.push(r.id);
    cityStateGroups.set(key, existing);
  }
  for (const [key, ids] of cityStateGroups) {
    if (ids.length > 1) {
      const [city, state] = key.split("|");
      overlaps.push({
        kind: "city_state",
        label: `${city.replace(/\b\w/g, (c) => c.toUpperCase())}, ${state.toUpperCase()}`,
        areaIds: ids,
      });
    }
  }

  // postal-code collisions across records
  const zipToIds = new Map<string, Set<string>>();
  for (const r of active) {
    const zips = [r.primaryPostalCode, ...r.postalCodesText.split(/\s+/)]
      .map((z) => normalizePostalCode(z))
      .filter(Boolean);
    for (const zip of zips) {
      const set = zipToIds.get(zip) ?? new Set<string>();
      set.add(r.id);
      zipToIds.set(zip, set);
    }
  }
  for (const [zip, idSet] of zipToIds) {
    if (idSet.size > 1) {
      overlaps.push({
        kind: "postal_code",
        label: zip,
        areaIds: Array.from(idSet),
      });
    }
  }

  return overlaps;
}

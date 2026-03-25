import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

const fallbackMaintenance = [
  {
    id: "maint_1",
    name: "Tropical Combo",
    status: "Open maintenance",
    note: "Seam inspection and blower check pending",
    openedAt: "May 20, 2026",
    costLabel: "$0",
  },
  {
    id: "maint_2",
    name: "Mega Splash Water Slide",
    status: "Ready",
    note: "Cleaned and inspected after weekend rental",
    openedAt: "May 18, 2026",
    costLabel: "$45",
  },
  {
    id: "maint_3",
    name: "Generator Add-on",
    status: "Service due",
    note: "Oil change reminder before next heavy weekend",
    openedAt: "May 16, 2026",
    costLabel: "$0",
  },
];

export async function getMaintenanceRecords() {
  if (!hasSupabaseEnv()) {
    return fallbackMaintenance;
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return fallbackMaintenance;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_records")
    .select(
      "id, maintenance_type, status, opened_at, completed_at, vendor_name, cost_amount, notes, assets!inner(organization_id, products(name), asset_tag)"
    )
    .eq("organization_id", ctx.organizationId)
    .order("opened_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return fallbackMaintenance;
  }

  return data.map((record) => {
    const asset = (record as Record<string, unknown>).assets as {
      asset_tag?: string;
      products?: { name?: string } | null;
    } | null;

    const productName = asset?.products?.name ?? asset?.asset_tag ?? "Asset";
    const type = (record.maintenance_type ?? "service")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    const status = (record.status ?? "open")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    return {
      id: record.id,
      name: productName,
      status,
      note: record.notes ?? `${type}${record.vendor_name ? ` · ${record.vendor_name}` : ""}`,
      openedAt: record.opened_at
        ? new Date(record.opened_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "TBD",
      costLabel: `$${typeof record.cost_amount === "number" ? record.cost_amount : 0}`,
    };
  });
}

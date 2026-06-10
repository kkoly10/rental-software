#!/usr/bin/env node
/**
 * Resets the E2E operator org to a "just-onboarded" state so the
 * vertical walkthrough suites (tests/e2e/*.spec.ts) start from the
 * same blank slate a brand-new operator sees: 0 products, 0 orders,
 * 0 customers, seeded default categories preserved.
 *
 * Deletes, in FK order: payments, documents, order_items, route_stops,
 * availability_blocks, orders, routes, customer_addresses, customers,
 * product add-ons/variants/specs/images/attributes, assets, products.
 * Also clears the last hour of rate_limit_windows so repeated suite
 * runs don't trip the sign-in / action throttles.
 *
 * Usage:
 *   E2E_ORG_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/e2e-reset-org.mjs
 *
 * Requires the service-role key because RLS (rightly) blocks an anon
 * client from bulk-deleting another org's rows. Never run this against
 * an org that isn't a dedicated test org — the deletes are permanent.
 */
import { createClient } from "@supabase/supabase-js";

const orgId = process.env.E2E_ORG_ID;
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!orgId || !url || !serviceKey) {
  console.error(
    "Missing env. Need E2E_ORG_ID, SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function ids(table, column, filterColumn, filterValues) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .in(filterColumn, filterValues);
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data.map((r) => r[column]);
}

async function del(table, column, values) {
  if (values.length === 0) return;
  const { error } = await supabase.from(table).delete().in(column, values);
  if (error) throw new Error(`${table} delete failed: ${error.message}`);
  console.log(`  ✓ ${table}`);
}

const org = [orgId];

const orderIds = await ids("orders", "id", "organization_id", org);
const routeIds = await ids("routes", "id", "organization_id", org);
const customerIds = await ids("customers", "id", "organization_id", org);
const productIds = await ids("products", "id", "organization_id", org);

console.log(
  `Resetting org ${orgId}: ${productIds.length} products, ${orderIds.length} orders, ${customerIds.length} customers`,
);

await del("payments", "order_id", orderIds);
await del("documents", "organization_id", org);
await del("order_items", "order_id", orderIds);
await del("route_stops", "route_id", routeIds);
await del("availability_blocks", "organization_id", org);
await del("orders", "id", orderIds);
await del("routes", "id", routeIds);
await del("customer_addresses", "customer_id", customerIds);
await del("customers", "id", customerIds);
await del("product_addons", "parent_product_id", productIds);
await del("product_addons", "addon_product_id", productIds);
await del("product_variants", "product_id", productIds);
await del("product_specs", "product_id", productIds);
await del("product_images", "product_id", productIds);
await del("product_attributes", "product_id", productIds);
await del("assets", "organization_id", org);
await del("products", "id", productIds);

// Throttle windows: clear the last hour so back-to-back suite runs
// don't hit the auth:signin / orders:update-status rate limits.
{
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("rate_limit_windows")
    .delete()
    .gte("window_start", oneHourAgo);
  if (error) throw new Error(`rate_limit_windows delete failed: ${error.message}`);
  console.log("  ✓ rate_limit_windows (last hour)");
}

console.log("Done — org is back to just-onboarded state.");

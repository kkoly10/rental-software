/**
 * Auto-attach with route creation — Sprint 1.5
 *
 * The Smart Delivery Mode change to `lib/routes/auto-attach.ts` adds
 * three new behaviors that need direct verification:
 *
 *   1. Auto mode + no route exists for the event date → CREATE the
 *      route (named "Deliveries for {formatted date}") and attach.
 *   2. Auto mode + 2nd same-date order → bundle into the existing
 *      auto-created route.
 *   3. Manual mode preserves the legacy bail-on-no-route behavior.
 *
 * These run against a hand-rolled in-memory Supabase double, not the
 * real database. The double models just enough of the PostgREST query
 * chain that auto-attach exercises (.from().select().eq().maybeSingle(),
 * .insert().select().single(), .rpc()) so we can assert behavior
 * without booting a full pg stack. The integration-level confidence —
 * "does the migration apply cleanly?" — is covered by the SQL test
 * suite that runs against the migration files.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { autoAttachOrderToRouteIfEligible } from "../lib/routes/auto-attach.ts";

type Row = Record<string, unknown>;

/**
 * Build a fake Supabase client whose behavior is driven by the
 * test-supplied tables map plus a list of (`table`, `payload`) inserts
 * we can introspect after the action runs.
 */
function makeFakeSupabase(tables: Record<string, Row[]>) {
  const inserts: { table: string; payload: Row }[] = [];
  const rpcCalls: { fn: string; args: Row }[] = [];

  // Simulate add_stop_to_route by appending to route_stops.
  const handleRpc = (fn: string, args: Row): { error: null | { message: string } } => {
    rpcCalls.push({ fn, args });
    if (fn === "add_stop_to_route") {
      const routeId = args.p_route_id as string;
      const seq = (tables.route_stops ?? []).filter((s) => s.route_id === routeId).length + 1;
      (tables.route_stops ??= []).push({
        id: `stop_${Math.random().toString(36).slice(2, 8)}`,
        route_id: routeId,
        order_id: args.p_order_id,
        stop_type: args.p_stop_type,
        stop_sequence: seq,
        scheduled_window_start: args.p_scheduled_window_start,
        stop_status: "pending",
      });
      return { error: null };
    }
    return { error: { message: `unknown rpc ${fn}` } };
  };

  function makeQuery(table: string) {
    let rows = [...(tables[table] ?? [])];
    let isUpdate = false;
    let isDelete = false;
    let updatePayload: Row | null = null;
    const builder = {
      select(_cols?: string) {
        return builder;
      },
      insert(payload: Row) {
        inserts.push({ table, payload });
        const inserted = { id: `id_${Math.random().toString(36).slice(2, 8)}`, ...payload };
        (tables[table] ??= []).push(inserted);
        // Make sure subsequent .single() returns the inserted row.
        rows = [inserted];
        return builder;
      },
      update(payload: Row) {
        isUpdate = true;
        updatePayload = payload;
        return builder;
      },
      delete() {
        isDelete = true;
        return builder;
      },
      eq(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] === val);
        return builder;
      },
      is(col: string, val: null) {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return builder;
      },
      limit(_n: number) {
        return builder;
      },
      order(_col: string, _opts: unknown) {
        return builder;
      },
      maybeSingle() {
        if (isUpdate && updatePayload) {
          for (const r of rows) Object.assign(r, updatePayload);
        }
        if (isDelete) {
          for (const r of rows) {
            const arr = tables[table];
            if (arr) {
              const idx = arr.indexOf(r);
              if (idx >= 0) arr.splice(idx, 1);
            }
          }
        }
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        if (rows.length === 0) {
          return Promise.resolve({ data: null, error: { message: "no row" } });
        }
        return Promise.resolve({ data: rows[0], error: null });
      },
      then(resolve: (value: { data: Row[] | null; error: null }) => void) {
        if (isUpdate && updatePayload) {
          for (const r of rows) Object.assign(r, updatePayload);
        }
        resolve({ data: rows, error: null });
      },
    };
    return builder;
  }

  return {
    fake: {
      from(table: string) {
        return makeQuery(table);
      },
      rpc(fn: string, args: Row) {
        return Promise.resolve(handleRpc(fn, args));
      },
    },
    inserts,
    rpcCalls,
    tables,
  };
}

test("auto mode + no existing route → creates 'Deliveries for {date}' and attaches", async () => {
  const orgId = "org_1";
  const orderId = "order_1";
  const tables: Record<string, Row[]> = {
    organizations: [
      { id: orgId, routing_mode: "auto", settings: {} },
    ],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "123 Main St",
        event_start_time: "2026-07-04T14:00:00Z",
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [],
  };

  const { fake, inserts, rpcCalls } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);

  assert.equal(result.attached, true);
  if (!result.attached) return;
  assert.equal(result.created, true);
  assert.match(result.routeName, /^Deliveries for /);

  const routeInsert = inserts.find((i) => i.table === "routes");
  assert.ok(routeInsert, "expected a routes insert");
  if (!routeInsert) return; // Type narrowing — assert.ok doesn't have TS asserts signatures.
  assert.equal((routeInsert.payload as Row).organization_id, orgId);
  assert.equal((routeInsert.payload as Row).route_date, "2026-07-04");
  assert.equal((routeInsert.payload as Row).route_status, "planned");

  const addStopCall = rpcCalls.find((c) => c.fn === "add_stop_to_route");
  assert.ok(addStopCall, "expected add_stop_to_route RPC");
  if (!addStopCall) return;
  assert.equal((addStopCall.args as Row).p_order_id, orderId);
});

test("manual mode + no existing route → bails with no_route (no creation)", async () => {
  const orgId = "org_2";
  const orderId = "order_2";
  const tables: Record<string, Row[]> = {
    organizations: [
      { id: orgId, routing_mode: "manual", settings: {} },
    ],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "123 Main St",
        event_start_time: null,
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [],
  };

  const { fake, inserts } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);

  assert.equal(result.attached, false);
  if (result.attached) return;
  assert.equal(result.reason, "no_route");

  const routeInsert = inserts.find((i) => i.table === "routes");
  assert.equal(routeInsert, undefined, "manual mode must not auto-create a route");
});

test("auto mode + existing same-date route → bundles (no new route created)", async () => {
  const orgId = "org_3";
  const orderId = "order_3";
  const existingRouteId = "route_existing";
  const tables: Record<string, Row[]> = {
    organizations: [
      { id: orgId, routing_mode: "auto", settings: {} },
    ],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "456 Oak St",
        event_start_time: "2026-07-04T10:00:00Z",
        deleted_at: null,
      },
    ],
    route_stops: [
      {
        id: "stop_pre",
        route_id: existingRouteId,
        order_id: "earlier_order",
        stop_sequence: 1,
        scheduled_window_start: "2026-07-04T16:00:00Z",
        stop_status: "pending",
      },
    ],
    routes: [
      {
        id: existingRouteId,
        organization_id: orgId,
        route_date: "2026-07-04",
        route_status: "planned",
        name: "Deliveries for 2026-07-04",
        deleted_at: null,
      },
    ],
  };

  const { fake, inserts } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);

  assert.equal(result.attached, true);
  if (!result.attached) return;
  assert.equal(result.created, false, "existing route should be reused, not recreated");
  assert.equal(result.routeId, existingRouteId);

  const routeInsert = inserts.find((i) => i.table === "routes");
  assert.equal(routeInsert, undefined, "bundling must not insert a new route");
});

test("legacy settings.auto_route_on_confirm=false is honored as manual", async () => {
  const orgId = "org_4";
  const orderId = "order_4";
  const tables: Record<string, Row[]> = {
    organizations: [
      // routing_mode is 'auto' but legacy kill switch is set; the
      // post-migration safety net should treat this as manual.
      {
        id: orgId,
        routing_mode: "auto",
        settings: { auto_route_on_confirm: false },
      },
    ],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "789 Pine Ave",
        event_start_time: null,
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [],
  };

  const { fake, inserts } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);

  assert.equal(result.attached, false);
  if (result.attached) return;
  assert.equal(result.reason, "no_route");
  const routeInsert = inserts.find((i) => i.table === "routes");
  assert.equal(routeInsert, undefined, "legacy kill switch must prevent route creation");
});

test("order with no event_date returns no_event_date and skips work", async () => {
  const orgId = "org_5";
  const orderId = "order_5";
  const tables: Record<string, Row[]> = {
    organizations: [{ id: orgId, routing_mode: "auto", settings: {} }],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: null,
        delivery_line1: "100 Anywhere",
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [],
  };

  const { fake, inserts, rpcCalls } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);
  assert.equal(result.attached, false);
  if (result.attached) return;
  assert.equal(result.reason, "no_event_date");
  assert.equal(inserts.length, 0);
  assert.equal(rpcCalls.length, 0);
});

test("order with no delivery address returns no_address and skips work", async () => {
  const orgId = "org_6";
  const orderId = "order_6";
  const tables: Record<string, Row[]> = {
    organizations: [{ id: orgId, routing_mode: "auto", settings: {} }],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "",
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [],
  };

  const { fake, inserts } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);
  assert.equal(result.attached, false);
  if (result.attached) return;
  assert.equal(result.reason, "no_address");
  assert.equal(inserts.length, 0);
});

test("two routes for the same date → ambiguous (operator must pick)", async () => {
  const orgId = "org_7";
  const orderId = "order_7";
  const tables: Record<string, Row[]> = {
    organizations: [{ id: orgId, routing_mode: "auto", settings: {} }],
    orders: [
      {
        id: orderId,
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "111 First",
        event_start_time: null,
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [
      { id: "route_a", organization_id: orgId, route_date: "2026-07-04", route_status: "planned", deleted_at: null },
      { id: "route_b", organization_id: orgId, route_date: "2026-07-04", route_status: "planned", deleted_at: null },
    ],
  };

  const { fake, inserts, rpcCalls } = makeFakeSupabase(tables);
  const result = await autoAttachOrderToRouteIfEligible(orgId, orderId, fake);
  assert.equal(result.attached, false);
  if (result.attached) return;
  assert.equal(result.reason, "ambiguous");
  assert.equal(inserts.length, 0);
  assert.equal(rpcCalls.length, 0);
});

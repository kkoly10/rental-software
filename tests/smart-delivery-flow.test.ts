/**
 * Smart Delivery Mode flow smoke test — Sprint 1.5
 *
 * The unit suites cover individual functions (auto-attach,
 * removeOrderStopOnCancel). This test stitches them together to
 * verify the **full happy path** a noob operator hits when running
 * in auto mode:
 *
 *   1. First confirm → no route exists → auto-creates "Deliveries
 *      for {date}" and attaches the order as stop #1.
 *   2. Second confirm same day → auto-bundles into the same route as
 *      stop #2 (later event_start_time sorts later).
 *   3. Cancel the first order → its stop is removed; route stays
 *      with one stop.
 *   4. Cancel the second order → last stop goes; route is cleaned up.
 *
 * This is the closest thing to a Playwright walkthrough we can run
 * without booting a browser + auth + Supabase. The fake double here
 * is shared with auto-attach-create.test.ts but extended to honor
 * the cancellation RPC.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { autoAttachOrderToRouteIfEligible } from "../lib/routes/auto-attach.ts";
import { removeOrderStopOnCancel } from "../lib/routes/remove-stop-on-cancel.ts";

type Row = Record<string, unknown>;

function makeFlowFake(tables: Record<string, Row[]>) {
  const rpcCalls: { fn: string; args: Row }[] = [];

  const handleRpc = (fn: string, args: Row): { error: null; data?: Row | Row[] } => {
    rpcCalls.push({ fn, args });

    if (fn === "add_stop_to_route") {
      const routeId = args.p_route_id as string;
      const seq = (tables.route_stops ??= []).filter((s) => s.route_id === routeId).length + 1;
      tables.route_stops.push({
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

    if (fn === "remove_order_stop_on_cancel") {
      const orderId = args.p_order_id as string;
      const orgId = args.p_org_id as string;
      const stops = (tables.route_stops ??= []);
      const stop = stops.find((s) => s.order_id === orderId);
      if (!stop) {
        return {
          error: null,
          data: { ok: true, reason: null, removed: false, route_deleted: false, route_id: null },
        };
      }
      const route = (tables.routes ??= []).find(
        (r) => r.id === stop.route_id,
      );
      if (!route || route.organization_id !== orgId) {
        return {
          error: null,
          data: { ok: false, reason: "org_mismatch", removed: false, route_deleted: false, route_id: null },
        };
      }
      // Remove stop.
      tables.route_stops = stops.filter((s) => s.id !== stop.id);
      // Re-sequence remaining.
      const remaining = tables.route_stops
        .filter((s) => s.route_id === stop.route_id)
        .sort((a, b) => (Number(a.stop_sequence) ?? 0) - (Number(b.stop_sequence) ?? 0));
      remaining.forEach((s, idx) => {
        s.stop_sequence = idx + 1;
      });
      // Delete route if empty + planned.
      let routeDeleted = false;
      if (remaining.length === 0 && route.route_status === "planned") {
        tables.routes = tables.routes.filter((r) => r.id !== route.id);
        routeDeleted = true;
      }
      return {
        error: null,
        data: {
          ok: true,
          reason: null,
          removed: true,
          route_deleted: routeDeleted,
          route_id: stop.route_id as string,
        },
      };
    }

    return { error: null };
  };

  function makeQuery(table: string) {
    let rows = [...(tables[table] ?? [])];
    let isUpdate = false;
    let isDelete = false;
    let updatePayload: Row | null = null;
    const builder = {
      select() { return builder; },
      insert(payload: Row) {
        const inserted = { id: `id_${Math.random().toString(36).slice(2, 8)}`, ...payload };
        (tables[table] ??= []).push(inserted);
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
      limit() { return builder; },
      order() { return builder; },
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
        return Promise.resolve({
          data: rows[0] ?? null,
          error: rows.length === 0 ? { message: "no row" } : null,
        });
      },
      then(resolve: (v: { data: Row[]; error: null }) => void) {
        resolve({ data: rows, error: null });
      },
    };
    return builder;
  }

  return {
    fake: {
      from: (table: string) => makeQuery(table),
      rpc: (fn: string, args: Row) => {
        const result = handleRpc(fn, args);
        return {
          maybeSingle: () => Promise.resolve({ data: result.data ?? null, error: null }),
        };
      },
    },
    rpcCalls,
    tables,
  };
}

test("full noob flow: first confirm auto-creates route, second confirm bundles, two cancels clean up", async () => {
  const orgId = "org_flow";
  const tables: Record<string, Row[]> = {
    organizations: [{ id: orgId, routing_mode: "auto", settings: {} }],
    orders: [
      {
        id: "order_first",
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "1 First St",
        event_start_time: "2026-07-04T09:00:00Z",
        deleted_at: null,
      },
      {
        id: "order_second",
        organization_id: orgId,
        event_date: "2026-07-04",
        delivery_line1: "2 Second St",
        event_start_time: "2026-07-04T14:00:00Z",
        deleted_at: null,
      },
    ],
    route_stops: [],
    routes: [],
  };

  const { fake, rpcCalls } = makeFlowFake(tables);

  // Step 1: first confirm.
  // @ts-expect-error fake supabase
  const r1 = await autoAttachOrderToRouteIfEligible(orgId, "order_first", fake);
  assert.equal(r1.attached, true, "first confirm should attach");
  if (!r1.attached) return;
  assert.equal(r1.created, true, "first confirm should create the route");
  assert.equal(tables.routes.length, 1, "one route after first confirm");
  assert.equal(tables.route_stops.length, 1, "one stop after first confirm");

  const routeId = tables.routes[0].id as string;
  assert.equal(r1.routeId, routeId);

  // Step 2: second confirm same date — bundles into the same route.
  // @ts-expect-error fake supabase
  const r2 = await autoAttachOrderToRouteIfEligible(orgId, "order_second", fake);
  assert.equal(r2.attached, true, "second confirm should attach");
  if (!r2.attached) return;
  assert.equal(r2.created, false, "second confirm should reuse existing route");
  assert.equal(tables.routes.length, 1, "still one route after second confirm");
  assert.equal(tables.route_stops.length, 2, "two stops after second confirm");
  assert.equal(r2.routeId, routeId, "second confirm bundles into the first route");

  // Step 3: cancel the first order — its stop is removed, route stays.
  // @ts-expect-error fake supabase
  const c1 = await removeOrderStopOnCancel(orgId, "order_first", fake);
  assert.equal(c1.ok, true, "first cancel should succeed");
  if (!c1.ok) return;
  assert.equal(c1.removed, true, "first cancel removes a stop");
  assert.equal(c1.routeDeleted, false, "route still has the second stop");
  assert.equal(tables.routes.length, 1, "route persists with remaining stop");
  assert.equal(tables.route_stops.length, 1, "one stop remains");
  assert.equal(tables.route_stops[0].order_id, "order_second");

  // Step 4: cancel the second (last) order — stop removed, route cleaned up.
  // @ts-expect-error fake supabase
  const c2 = await removeOrderStopOnCancel(orgId, "order_second", fake);
  assert.equal(c2.ok, true, "second cancel should succeed");
  if (!c2.ok) return;
  assert.equal(c2.removed, true, "second cancel removes a stop");
  assert.equal(c2.routeDeleted, true, "last stop gone → route cleaned up");
  assert.equal(tables.routes.length, 0, "zero routes after final cancel");
  assert.equal(tables.route_stops.length, 0, "zero stops after final cancel");

  // Sanity check: the RPC calls hit the right names in the right order.
  const rpcNames = rpcCalls.map((c) => c.fn);
  assert.deepEqual(
    rpcNames,
    [
      "add_stop_to_route",
      "add_stop_to_route",
      "remove_order_stop_on_cancel",
      "remove_order_stop_on_cancel",
    ],
    "RPC sequence matches the flow",
  );
});

test("flow: cancel an order with no stop is idempotent — no error, no removal", async () => {
  const orgId = "org_noop";
  const tables: Record<string, Row[]> = {
    organizations: [{ id: orgId, routing_mode: "auto", settings: {} }],
    route_stops: [],
    routes: [],
  };

  const { fake } = makeFlowFake(tables);

  // @ts-expect-error fake supabase
  const result = await removeOrderStopOnCancel(orgId, "order_ghost", fake);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.removed, false);
  assert.equal(result.routeDeleted, false);
});

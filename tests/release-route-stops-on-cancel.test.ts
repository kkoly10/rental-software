/**
 * `releaseRouteStopsForCancelledOrder` — Sprint 1.5 follow-up to decision 2.6
 *
 * When an order is cancelled, every non-completed/non-skipped route stop
 * attached to it is detached so the crew app doesn't surface the cancelled
 * work. Completed/skipped stops stay as an audit record. These tests pin
 * that policy.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { releaseRouteStopsForCancelledOrder } from "../lib/routes/release-stops-on-cancel.ts";

type Row = Record<string, unknown>;

/**
 * Minimal supabase fake for this action — supports the chained
 * `from(...).select(...).eq(...).eq(...).not(...)` query and the
 * `from(...).delete().in(...)` write. Not reused with the bigger flow
 * fakes because the query shape this action uses is small.
 */
function makeFake(stops: Row[]) {
  type Filter = (r: Row) => boolean;

  function makeBuilder(table: string) {
    let rows = table === "route_stops" ? [...stops] : [];
    const filters: Filter[] = [];
    let isDelete = false;

    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      delete() {
        isDelete = true;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => {
          // Support the dotted form .eq("routes.organization_id", val)
          // by walking nested object literals on the row.
          if (col.includes(".")) {
            const parts = col.split(".");
            let cur: unknown = r;
            for (const p of parts) {
              if (cur && typeof cur === "object") {
                cur = (cur as Row)[p];
              } else {
                cur = undefined;
              }
            }
            return cur === val;
          }
          return r[col] === val;
        });
        return builder;
      },
      not(col: string, op: string, val: string) {
        // Crude parse for: not("stop_status", "in", "(completed,skipped)")
        const set = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim());
        if (op !== "in") return builder;
        filters.push((r) => !set.includes(String(r[col])));
        return builder;
      },
      in(col: string, vals: unknown[]) {
        const set = new Set(vals);
        filters.push((r) => set.has(r[col]));
        return builder;
      },
      then(resolve: (v: { data: Row[] | null; error: null }) => void) {
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        if (isDelete) {
          for (const r of filtered) {
            const i = stops.indexOf(r);
            if (i >= 0) stops.splice(i, 1);
          }
        }
        resolve({ data: filtered, error: null });
      },
    };
    return builder;
  }

  return {
    from(table: string) {
      return makeBuilder(table);
    },
  };
}

test("removes only non-terminal stops, returns affected route IDs", async () => {
  const stops: Row[] = [
    {
      id: "stop_a",
      route_id: "route_1",
      order_id: "order_X",
      stop_status: "assigned",
      routes: { organization_id: "org_1" },
    },
    {
      id: "stop_b",
      route_id: "route_2",
      order_id: "order_X",
      stop_status: "en_route",
      routes: { organization_id: "org_1" },
    },
    {
      id: "stop_c",
      route_id: "route_1",
      order_id: "order_X",
      stop_status: "completed", // must NOT be removed
      routes: { organization_id: "org_1" },
    },
    {
      id: "stop_d",
      route_id: "route_3",
      order_id: "order_Y", // different order — must NOT be touched
      stop_status: "assigned",
      routes: { organization_id: "org_1" },
    },
  ];
  const fake = makeFake(stops);

  // @ts-expect-error fake supabase
  const result = await releaseRouteStopsForCancelledOrder("org_1", "order_X", fake);

  assert.equal(result.removedCount, 2);
  assert.deepEqual(result.affectedRouteIds.sort(), ["route_1", "route_2"]);

  const remainingIds = stops.map((s) => s.id).sort();
  assert.deepEqual(remainingIds, ["stop_c", "stop_d"]);
});

test("no matching stops → ok with zero counts", async () => {
  const stops: Row[] = [];
  const fake = makeFake(stops);

  // @ts-expect-error fake supabase
  const result = await releaseRouteStopsForCancelledOrder("org_1", "order_ghost", fake);

  assert.equal(result.removedCount, 0);
  assert.deepEqual(result.affectedRouteIds, []);
});

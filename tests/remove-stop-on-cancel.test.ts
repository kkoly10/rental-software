/**
 * `removeOrderStopOnCancel` wrapper — Sprint 1.5 follow-up
 *
 * The cancellation cleanup was moved into the Postgres RPC
 * `remove_order_stop_on_cancel` (see migration 20260603_030000) so
 * the delete-stop / re-sequence / delete-route steps run inside one
 * transaction with a row lock on the parent route. The wrapper here
 * just translates the RPC's return shape into the TypeScript result
 * the orders cancellation flow consumes — these tests pin that
 * translation so a future refactor can't silently desync the two.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { removeOrderStopOnCancel } from "../lib/routes/remove-stop-on-cancel.ts";

type Row = Record<string, unknown>;

function makeFakeRpc(
  response:
    | { data: Row | null; error?: { message: string } }
    | { sequence: Array<{ data: Row | null; error?: { message: string } }> }
) {
  const calls: { fn: string; args: Row }[] = [];
  // Decision 2.6 — the wrapper now loops the RPC until it reports
  // `removed: false`, because a single cancellation can clean up both a
  // delivery and a pickup stop. Tests that want to assert single-call
  // semantics use the `sequence` form to terminate the loop after N
  // matching responses with a final {removed: false}.
  let cursor = 0;
  const fake = {
    rpc(fn: string, args: Row) {
      calls.push({ fn, args });
      const r =
        "sequence" in response
          ? response.sequence[Math.min(cursor++, response.sequence.length - 1)]
          : response;
      return {
        maybeSingle: () =>
          Promise.resolve({
            data: r.data,
            error: r.error ?? null,
          }),
      };
    },
  };
  return { fake, calls };
}

test("stop removed but route still has stops → removed=true, routeDeleted=false", async () => {
  const { fake, calls } = makeFakeRpc({
    sequence: [
      {
        data: {
          ok: true,
          reason: null,
          removed: true,
          route_deleted: false,
          route_id: "route_a",
        },
      },
      // Loop-terminating response — order has no more stops.
      {
        data: {
          ok: true,
          reason: null,
          removed: false,
          route_deleted: false,
          route_id: null,
        },
      },
    ],
  });

  const result = await removeOrderStopOnCancel("org_1", "order_1", fake);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.removed, true);
  assert.equal(result.routeDeleted, false);
  assert.equal(result.routeId, "route_a");
  // 1 removing call + 1 terminating call (decision 2.6 loop).
  assert.equal(calls.length, 2);
  assert.equal(calls[0].fn, "remove_order_stop_on_cancel");
  assert.deepEqual(calls[0].args, { p_order_id: "order_1", p_org_id: "org_1" });
});

test("last stop removed → routeDeleted=true with route_id surfaced", async () => {
  const { fake } = makeFakeRpc({
    sequence: [
      {
        data: {
          ok: true,
          reason: null,
          removed: true,
          route_deleted: true,
          route_id: "route_b",
        },
      },
      // Loop terminates here.
      {
        data: {
          ok: true,
          reason: null,
          removed: false,
          route_deleted: false,
          route_id: null,
        },
      },
    ],
  });

  const result = await removeOrderStopOnCancel("org_2", "order_2", fake);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.removed, true);
  assert.equal(result.routeDeleted, true);
  assert.equal(result.routeId, "route_b");
});

test("order has no stop → idempotent success, removed=false", async () => {
  const { fake } = makeFakeRpc({
    data: {
      ok: true,
      reason: null,
      removed: false,
      route_deleted: false,
      route_id: null,
    },
  });

  const result = await removeOrderStopOnCancel("org_3", "order_3", fake);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.removed, false);
  assert.equal(result.routeDeleted, false);
  assert.equal(result.routeId, null);
});

test("RPC returns ok=false → wrapper returns ok=false with reason", async () => {
  const { fake } = makeFakeRpc({
    data: {
      ok: false,
      reason: "org_mismatch",
      removed: false,
      route_deleted: false,
      route_id: null,
    },
  });

  const result = await removeOrderStopOnCancel("org_4", "order_4", fake);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "org_mismatch");
});

test("RPC error surfaces as rpc_failed with detail", async () => {
  const { fake } = makeFakeRpc({
    data: null,
    error: { message: "connection lost" },
  });

  const result = await removeOrderStopOnCancel("org_5", "order_5", fake);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "rpc_failed");
  assert.equal(result.detail, "connection lost");
});

test("RPC returns null data (empty result) surfaces as rpc_empty", async () => {
  const { fake } = makeFakeRpc({ data: null });

  const result = await removeOrderStopOnCancel("org_6", "order_6", fake);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "rpc_empty");
});

test("thrown exception caught and reported as exception", async () => {
  const fake = {
    rpc() {
      throw new Error("network exploded");
    },
  };

  const result = await removeOrderStopOnCancel("org_7", "order_7", fake);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "exception");
  assert.equal(result.detail, "network exploded");
});

/**
 * Tier-2 launch hardening — pin the Stripe webhook ledger state
 * machine. The pre-fix handler deleted the dedup row on any handler
 * failure, which let a concurrent retry replay every side-effect
 * whose dedup the unique payment index doesn't cover (confirmation
 * emails, operator notifications). The Tier-2 helper widens the
 * ledger so failure ≠ release. These tests drive every transition
 * with a fake admin client so we don't need a Stripe stub or a real
 * Supabase round-trip; if the state machine ever regresses, this
 * suite catches it before a real charge confirmation is double-sent.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  claimWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventSucceeded,
} from "../lib/stripe/webhook-ledger.ts";

type Row = {
  event_id: string;
  event_type: string;
  processing_status: "claimed" | "succeeded" | "failed";
  attempt_count: number;
  last_error?: string | null;
  finished_at?: string | null;
};

/**
 * Minimal in-memory shim of the supabase-js fluent API surface the
 * ledger touches: from(table).insert, from(table).update.eq.eq.eq.select,
 * from(table).select.eq.maybeSingle. Returns the row(s) the ledger
 * helper would receive, and lets us simulate concurrent-write races by
 * mutating `state.rows` between calls.
 */
function makeFakeAdmin(state: { rows: Row[]; insertError?: { code?: string; message: string } | null }) {
  return {
    from(table: string) {
      assert.equal(table, "stripe_webhook_events");

      return {
        insert(values: Partial<Row>) {
          if (state.insertError) {
            const err = state.insertError;
            state.insertError = null; // one-shot
            return Promise.resolve({ error: err });
          }
          if (state.rows.some((r) => r.event_id === values.event_id)) {
            return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
          }
          state.rows.push({
            event_id: String(values.event_id),
            event_type: String(values.event_type),
            processing_status: (values.processing_status as Row["processing_status"]) ?? "claimed",
            attempt_count: Number(values.attempt_count ?? 1),
            last_error: null,
            finished_at: null,
          });
          return Promise.resolve({ error: null });
        },

        select(_fields: string) {
          let matchedRows: Row[] = state.rows.slice();

          // The chain after a select: .eq().eq().eq().select() or .eq().maybeSingle()
          const finalize = () => ({
            data: matchedRows.map((r) => ({ event_id: r.event_id })),
            error: null,
          });

          return {
            eq(col: keyof Row, val: Row[keyof Row]) {
              matchedRows = matchedRows.filter((r) => r[col] === val);
              return this;
            },
            maybeSingle() {
              return Promise.resolve({
                data: matchedRows[0] ?? null,
                error: null,
              });
            },
            select() {
              return Promise.resolve(finalize());
            },
          };
        },

        update(patch: Partial<Row>) {
          let matchedRows: Row[] = state.rows.slice();
          const chain = {
            eq(col: keyof Row, val: Row[keyof Row]) {
              matchedRows = matchedRows.filter((r) => r[col] === val);
              return chain;
            },
            select() {
              for (const r of matchedRows) Object.assign(r, patch);
              return Promise.resolve({
                data: matchedRows.map((r) => ({ event_id: r.event_id })),
                error: null,
              });
            },
            then(resolve: (v: { error: null }) => void) {
              for (const r of matchedRows) Object.assign(r, patch);
              resolve({ error: null });
            },
          };
          return chain;
        },
      };
    },
  } as unknown as Parameters<typeof claimWebhookEvent>[0];
}

test("first delivery of an event is claimed with attempt=1", async () => {
  const state = { rows: [] as Row[] };
  const admin = makeFakeAdmin(state);
  const outcome = await claimWebhookEvent(admin, "evt_1", "checkout.session.completed");
  assert.deepEqual(outcome, { kind: "claimed", attempt: 1 });
  assert.equal(state.rows.length, 1);
  assert.equal(state.rows[0].processing_status, "claimed");
  assert.equal(state.rows[0].attempt_count, 1);
});

test("redelivery of a SUCCEEDED event reports duplicate", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_done",
        event_type: "checkout.session.completed",
        processing_status: "succeeded" as const,
        attempt_count: 1,
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  const outcome = await claimWebhookEvent(admin, "evt_done", "checkout.session.completed");
  assert.equal(outcome.kind, "duplicate");
  // Row is unchanged — never re-flipped to claimed.
  assert.equal(state.rows[0].processing_status, "succeeded");
});

test("redelivery while a row is still CLAIMED reports duplicate (don't race in-flight worker)", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_inflight",
        event_type: "charge.refunded",
        processing_status: "claimed" as const,
        attempt_count: 1,
        last_error: null as string | null,
        finished_at: null as string | null,
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  const outcome = await claimWebhookEvent(admin, "evt_inflight", "charge.refunded");
  assert.equal(outcome.kind, "duplicate");
});

test("retry after a FAILED row re-claims and bumps the attempt counter", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_retry",
        event_type: "checkout.session.completed",
        processing_status: "failed" as const,
        attempt_count: 2,
        last_error: "stripe.api timeout",
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  const outcome = await claimWebhookEvent(admin, "evt_retry", "checkout.session.completed");
  assert.deepEqual(outcome, { kind: "claimed", attempt: 3 });
  assert.equal(state.rows[0].processing_status, "claimed");
  assert.equal(state.rows[0].attempt_count, 3);
  assert.equal(state.rows[0].last_error, null);
});

test("retry-exhausted: a FAILED row at the cap refuses to re-claim", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_poison",
        event_type: "checkout.session.completed",
        processing_status: "failed" as const,
        attempt_count: 5,
        last_error: "permanent shape error",
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  const outcome = await claimWebhookEvent(admin, "evt_poison", "checkout.session.completed");
  assert.deepEqual(outcome, { kind: "retry_exhausted", attempt: 5 });
  // Row stays failed at 5 — operator surfaces it from observability.
  assert.equal(state.rows[0].processing_status, "failed");
  assert.equal(state.rows[0].attempt_count, 5);
});

test("ledger_unavailable: a non-23505 insert error falls open", async () => {
  const state = {
    rows: [] as Row[],
    insertError: { code: "08001", message: "connection refused" },
  };
  const admin = makeFakeAdmin(state);
  const outcome = await claimWebhookEvent(admin, "evt_db_down", "charge.refunded");
  assert.equal(outcome.kind, "ledger_unavailable");
});

test("markWebhookEventSucceeded flips the row to succeeded + sets finished_at", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_ok",
        event_type: "checkout.session.completed",
        processing_status: "claimed" as const,
        attempt_count: 1,
        last_error: null as string | null,
        finished_at: null as string | null,
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  await markWebhookEventSucceeded(admin, "evt_ok");
  assert.equal(state.rows[0].processing_status, "succeeded");
  assert.ok(state.rows[0].finished_at, "finished_at must be set on success");
});

test("markWebhookEventFailed flips to failed + records the reason", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_bad",
        event_type: "checkout.session.completed",
        processing_status: "claimed" as const,
        attempt_count: 1,
        last_error: null as string | null,
        finished_at: null as string | null,
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  await markWebhookEventFailed(admin, "evt_bad", "TypeError: cannot read x of undefined");
  assert.equal(state.rows[0].processing_status, "failed");
  assert.equal(state.rows[0].last_error, "TypeError: cannot read x of undefined");
  assert.ok(state.rows[0].finished_at);
});

test("markWebhookEventFailed truncates pathological error strings", async () => {
  const state = {
    rows: [
      {
        event_id: "evt_huge_err",
        event_type: "checkout.session.completed",
        processing_status: "claimed" as const,
        attempt_count: 1,
        last_error: null as string | null,
        finished_at: null as string | null,
      },
    ],
  };
  const admin = makeFakeAdmin(state);
  await markWebhookEventFailed(admin, "evt_huge_err", "x".repeat(5000));
  assert.equal(state.rows[0].last_error?.length, 2000);
});

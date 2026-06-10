/**
 * PR-1 #1 — per-jurisdiction sales-tax lookup.
 *
 * Pins the lookup precedence (exact postal_code wins over state-wide
 * fallback) and the basis-points → cents math. The DB integration is
 * stubbed with a fake supabase client so the tests don't touch the
 * real DB; what we're verifying is the lookup logic, not Postgres.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeOrderTax } from "../lib/checkout/tax.ts";

type TaxRow = {
  rate_bps: number;
  label: string;
  postal_code: string | null;
};

function makeStub(rows: Array<{ state: string; postal_code: string | null } & TaxRow>) {
  return {
    from(_table: string) {
      let filter: {
        state?: string;
        postal_code?: string | null;
        postalIsNull?: boolean;
      } = {};
      const query = {
        select() {
          return query;
        },
        eq(col: string, val: string) {
          if (col === "state") filter.state = val;
          if (col === "postal_code") filter.postal_code = val;
          return query;
        },
        is(col: string, val: null) {
          if (col === "postal_code" && val === null) filter.postalIsNull = true;
          return query;
        },
        async maybeSingle() {
          const match = rows.find((r) => {
            if (filter.state && r.state !== filter.state) return false;
            if (filter.postalIsNull) {
              if (r.postal_code !== null) return false;
            } else if (filter.postal_code !== undefined) {
              if (r.postal_code !== filter.postal_code) return false;
            }
            return true;
          });
          return { data: match ?? null, error: null };
        },
      };
      return query;
    },
  } as any;
}

test("state-wide fallback used when no postal_code-specific rule exists", async () => {
  const supabase = makeStub([
    { state: "FL", postal_code: null, rate_bps: 600, label: "Florida sales tax" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: "FL",
    postalCode: "33101",
    taxableBaseCents: 10000, // $100.00
  });
  assert.equal(result.rateBps, 600);
  assert.equal(result.label, "Florida sales tax");
  assert.equal(result.taxCents, 600); // 6% of $100
});

test("postal_code-specific rule wins over state-wide fallback", async () => {
  const supabase = makeStub([
    { state: "FL", postal_code: null, rate_bps: 600, label: "Florida sales tax" },
    { state: "FL", postal_code: "33101", rate_bps: 700, label: "Miami-Dade combined" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: "FL",
    postalCode: "33101",
    taxableBaseCents: 10000,
  });
  assert.equal(result.label, "Miami-Dade combined");
  assert.equal(result.taxCents, 700);
});

test("missing rule for state returns zero", async () => {
  const supabase = makeStub([
    { state: "FL", postal_code: null, rate_bps: 600, label: "Florida sales tax" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: "CA",
    postalCode: "90210",
    taxableBaseCents: 10000,
  });
  assert.equal(result.taxCents, 0);
  assert.equal(result.label, null);
});

test("missing state (pickup order) returns zero", async () => {
  const supabase = makeStub([
    { state: "FL", postal_code: null, rate_bps: 600, label: "Florida" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: null,
    postalCode: null,
    taxableBaseCents: 10000,
  });
  assert.equal(result.taxCents, 0);
});

test("rounding: rate 825 bps × $33.33 base = $2.75 (Math.round)", async () => {
  // 3333 × 825 / 10000 = 275.0  → rounds to 275 cents = $2.75
  const supabase = makeStub([
    { state: "TX", postal_code: null, rate_bps: 825, label: "Texas" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: "TX",
    postalCode: null,
    taxableBaseCents: 3333,
  });
  assert.equal(result.taxCents, 275);
});

test("zero taxable base returns zero (don't query)", async () => {
  const supabase = makeStub([
    { state: "FL", postal_code: null, rate_bps: 600, label: "Florida" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: "FL",
    postalCode: null,
    taxableBaseCents: 0,
  });
  assert.equal(result.taxCents, 0);
});

test("state code normalized to upper 2-char", async () => {
  const supabase = makeStub([
    { state: "FL", postal_code: null, rate_bps: 600, label: "Florida" },
  ]);
  const result = await computeOrderTax(supabase, {
    organizationId: "org-1",
    state: " fl ",
    postalCode: null,
    taxableBaseCents: 10000,
  });
  assert.equal(result.taxCents, 600);
});

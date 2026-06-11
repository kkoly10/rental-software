import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Build plan Rule 1/Rule 4: marketplace code (lib/market, app/market,
 * components/market) may import shared PRIMITIVES but never operator
 * FEATURE modules. The repo has no ESLint config (lint = tsc), so the
 * boundary is enforced here — a forbidden import fails CI.
 *
 * Operator code importing lib/market/* is allowed (the Seller Hub in
 * the dashboard fronts the marketplace domain); the restriction is
 * one-directional by design.
 */

const MARKET_DIRS = ["lib/market", "app/market", "components/market"];

const FORBIDDEN_IMPORT_PREFIXES = [
  // operator flow logic
  "@/lib/orders",
  "@/lib/routes",
  "@/lib/checkout",
  "@/lib/crew",
  "@/lib/quotes",
  "@/lib/invoices",
  "@/lib/documents",
  "@/lib/logistics",
  "@/lib/portal",
  "@/lib/data/",
  "@/lib/onboarding",
  "@/lib/team",
  "@/lib/customers",
  "@/lib/assets",
  "@/lib/maintenance",
  "@/lib/service-areas",
  // operator/storefront UI
  "@/components/layout",
  "@/components/public",
  "@/components/dashboard",
  "@/components/orders",
  "@/components/checkout",
  "@/components/portal",
  "@/components/crew",
  "@/components/deliveries",
  "@/components/settings",
];

function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

test("marketplace modules never import operator feature code", () => {
  const root = process.cwd();
  const files = MARKET_DIRS.flatMap((d) => collectFiles(join(root, d)));
  assert.ok(files.length > 5, "expected marketplace source files to exist");

  const violations: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const prefix of FORBIDDEN_IMPORT_PREFIXES) {
      // Matches both `import ... from "X"` and `import("X")`.
      if (source.includes(`"${prefix}`) || source.includes(`'${prefix}`)) {
        violations.push(`${file.replace(root + "/", "")} imports ${prefix}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Marketplace boundary violations:\n${violations.join("\n")}`,
  );
});

test("operator middleware reserves the marketplace subdomains as org slugs", () => {
  const resolveOrg = readFileSync(join(process.cwd(), "lib/auth/resolve-org.ts"), "utf8");
  for (const reserved of ['"rent"', '"market"', '"marketplace"']) {
    assert.ok(
      resolveOrg.includes(reserved),
      `${reserved} must be in RESERVED_SLUGS — an org claiming it would shadow the marketplace host`,
    );
  }
});

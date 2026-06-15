import { test } from "node:test";
import { strict as assert } from "node:assert";
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

/**
 * PR-1f — getPublicOrgId() preview-org override.
 *
 * Verifies the ADDITIVE safety contract:
 *  - When runWithPreviewOrgId(orgId) is active, getPublicOrgId() returns that
 *    AUTH-resolved org id and NEVER consults the hostname resolver.
 *  - When NO override is set (every normal request), getPublicOrgId() falls
 *    through to today's exact hostname logic byte-for-byte (it calls
 *    resolveOrgFromHostname with the request host and returns its result; and
 *    returns null when Supabase env is absent).
 *
 * org-context.ts pulls in `server-only`, `next/headers`, supabase, and the
 * `@/` path alias — none resolvable under the node:test runner. A single ESM
 * resolve hook maps the `@/` alias to the repo root, stubs `server-only`,
 * `next/headers`, `react` (cache passthrough), `@/lib/env`, and
 * `@/lib/auth/resolve-org` to controllable in-memory modules so the REAL
 * org-context.ts (and the REAL preview-org-context.ts) load and run. The stubs
 * read test-controlled state from globalThis so the override read path through
 * the real cache()'d resolver is exercised end-to-end.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_URL = pathToFileURL(pathResolve(__dirname, "..") + "/").href;

const empty = "data:text/javascript,export%20%7B%7D";

// next/headers stub: headers().get(name) → g.__TEST_HOST for "host".
const nextHeadersStub =
  "data:text/javascript," +
  encodeURIComponent(`
    export async function headers() {
      return { get: (name) =>
        name === "host" ? (globalThis.__TEST_HOST ?? null) : null };
    }
    export async function cookies() { return { get: () => undefined }; }
  `);

// react stub: cache() must be a passthrough wrapper (single-call dedupe is not
// under test; identity behaviour is enough to exercise the real resolver body).
const reactStub =
  "data:text/javascript," +
  encodeURIComponent(`export function cache(fn){ return fn; }`);

// @/lib/env stub: hasSupabaseEnv() ← g.__TEST_HAS_ENV.
const envStub =
  "data:text/javascript," +
  encodeURIComponent(
    `export function hasSupabaseEnv(){ return globalThis.__TEST_HAS_ENV === true; }`
  );

// @/lib/auth/resolve-org stub: resolveOrgFromHostname(host) records the host it
// was called with and returns g.__TEST_HOSTNAME_ORG.
const resolveOrgStub =
  "data:text/javascript," +
  encodeURIComponent(`
    export async function resolveOrgFromHostname(host) {
      globalThis.__TEST_RESOLVE_HOST = host;
      return globalThis.__TEST_HOSTNAME_ORG ?? null;
    }
    export function getAppDomain(){ return "korent.app"; }
  `);

const loaderSource =
  "data:text/javascript," +
  encodeURIComponent(`
    const ROOT = ${JSON.stringify(ROOT_URL)};
    const STUBS = {
      "server-only": ${JSON.stringify(empty)},
      "next/headers": ${JSON.stringify(nextHeadersStub)},
      "react": ${JSON.stringify(reactStub)},
      "@/lib/env": ${JSON.stringify(envStub)},
      "@/lib/auth/resolve-org": ${JSON.stringify(resolveOrgStub)},
      // Supabase + cookie deps are imported by org-context but only reached
      // AFTER the override / env checks the tests exercise; stub them empty so
      // the module graph resolves.
      "@/lib/supabase/server": "data:text/javascript,export async function createSupabaseServerClient(){throw new Error('not reached in these tests');}",
      "@/lib/auth/org-cookie": "data:text/javascript,export const ACTIVE_ORG_COOKIE='active_org';",
      "@/lib/observability/server": "data:text/javascript,export async function logAppEvent(){}",
    };
    export async function resolve(specifier, context, nextResolve) {
      if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
      if (specifier.startsWith("@/")) {
        let target = ROOT + specifier.slice(2);
        if (!/\\.[a-z]+$/.test(specifier)) target += ".ts";
        return nextResolve(target, context);
      }
      return nextResolve(specifier, context);
    }
  `);

register(loaderSource);

// Test-controlled state the in-memory stub modules read at call time.
const g = globalThis as unknown as {
  __TEST_HOST?: string;
  __TEST_HAS_ENV?: boolean;
  __TEST_HOSTNAME_ORG?: string;
  __TEST_RESOLVE_HOST?: string;
};

const orgContext = await import("../lib/auth/org-context.ts");
const previewCtx = await import("../lib/auth/preview-org-context.ts");

test("override active → getPublicOrgId returns the override, skips hostname", async () => {
  g.__TEST_HAS_ENV = true;
  g.__TEST_HOST = "acme.korent.app";
  g.__TEST_HOSTNAME_ORG = "org-from-hostname";
  g.__TEST_RESOLVE_HOST = undefined;

  const result = await previewCtx.runWithPreviewOrgId("org-override-123", () =>
    orgContext.getPublicOrgId()
  );

  assert.equal(result, "org-override-123");
  // Hostname resolver must NOT have been consulted while the override was set.
  assert.equal(g.__TEST_RESOLVE_HOST, undefined);
});

test("no override → falls through to hostname logic (byte-for-byte today)", async () => {
  g.__TEST_HAS_ENV = true;
  g.__TEST_HOST = "acme.korent.app";
  g.__TEST_HOSTNAME_ORG = "org-from-hostname";
  g.__TEST_RESOLVE_HOST = undefined;

  const result = await orgContext.getPublicOrgId();

  assert.equal(result, "org-from-hostname");
  // The resolver was called with the request host — unchanged hostname path.
  assert.equal(g.__TEST_RESOLVE_HOST, "acme.korent.app");
});

test("no override + no Supabase env → null (unchanged short-circuit)", async () => {
  g.__TEST_HAS_ENV = false;
  g.__TEST_HOST = "acme.korent.app";
  g.__TEST_RESOLVE_HOST = undefined;

  const result = await orgContext.getPublicOrgId();

  assert.equal(result, null);
  // env gate short-circuits before the hostname resolver, as today.
  assert.equal(g.__TEST_RESOLVE_HOST, undefined);
});

test("override is cleared after runWithPreviewOrgId resolves", async () => {
  await previewCtx.runWithPreviewOrgId("org-x", async () => {
    assert.equal(previewCtx.getPreviewOrgIdOverride(), "org-x");
  });
  assert.equal(previewCtx.getPreviewOrgIdOverride(), null);
});

test("override propagates across awaited async work (ALS through RSC render)", async () => {
  const seen = await previewCtx.runWithPreviewOrgId("org-async", async () => {
    await new Promise((r) => setTimeout(r, 5));
    await Promise.resolve();
    return previewCtx.getPreviewOrgIdOverride();
  });
  assert.equal(seen, "org-async");
});

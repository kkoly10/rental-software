import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Preview-org override (PR-1f — embedded live preview canvas).
 *
 * The builder preview route renders the SAME storefront code the public site
 * does, but on the DASHBOARD host (e.g. app.korent.app/dashboard/...), where the
 * hostname-based tenant resolver (getPublicOrgId) can't resolve the operator's
 * org. To bridge that, the preview route runs its entire async render inside
 * `runWithPreviewOrgId(orgId, fn)`, which stashes the operator's org id (from
 * AUTH — getOrgContext, never user input) in an AsyncLocalStorage store.
 *
 * `getPublicOrgId()` checks `getPreviewOrgIdOverride()` at the very top: when a
 * non-null id is present it returns it; otherwise it falls through to today's
 * exact hostname logic. AsyncLocalStorage propagates through the awaited RSC
 * async render, so every nested cached loader (organization-settings,
 * content-settings, page-document, …) that calls getPublicOrgId resolves to the
 * operator's org while the preview is rendering.
 *
 * CRITICAL SAFETY PROPERTY: the store is ONLY ever entered inside the preview
 * route. For every other request the store is empty → getPreviewOrgIdOverride()
 * returns null → getPublicOrgId behaves byte-for-byte as it does today.
 *
 * Server-only: the store must never reach the client bundle.
 */
const previewOrgStorage = new AsyncLocalStorage<string>();

/**
 * Run `fn` with the preview org id installed in AsyncLocalStorage. Any code
 * awaited within `fn` (including nested React-cache()'d data loaders) sees the
 * override via getPreviewOrgIdOverride().
 */
export function runWithPreviewOrgId<T>(orgId: string, fn: () => T): T {
  return previewOrgStorage.run(orgId, fn);
}

/**
 * Returns the preview org id when the current async context is inside a
 * runWithPreviewOrgId() call, else null (the normal case for every request).
 */
export function getPreviewOrgIdOverride(): string | null {
  return previewOrgStorage.getStore() ?? null;
}

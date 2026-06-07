/**
 * Phase 4j — pure helpers for seeding default categories when a
 * vertical is added (#299).
 *
 * Pulled out of the action so the slug builder + the "compute next
 * sort_order" math can be unit-tested without touching Supabase. The
 * action keeps full ownership of the I/O (SELECTs, INSERTs); these
 * helpers just shape the data.
 */

/**
 * Turn a human-readable category name into a URL-safe slug that
 * matches the format the rest of the app uses (lowercase, hyphenated,
 * no leading/trailing hyphens).
 *
 * Defensive:
 *   - Lowercases first so a name like "TENTS" doesn't store a
 *     mixed-case slug downstream.
 *   - Replaces any run of non-alphanumeric characters (whitespace,
 *     punctuation, accents-already-stripped) with a single hyphen so
 *     "Round Table — 60in" becomes "round-table-60in".
 *   - Trims leading / trailing hyphens so " — Tents " can't store as
 *     "-tents-".
 *   - Returns an empty string when the input has no alphanumerics at
 *     all — caller decides whether to fall back to a placeholder or
 *     skip the row.
 */
export function slugifyCategoryName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Given the existing categories' max sort_order, return the next
 * batch of sort_orders for `count` new rows so they append cleanly
 * after the existing ones.
 *
 * `startSort` should be the MAX(sort_order) the caller observed in
 * the org's categories table, or 0 when there are none.
 */
export function nextSortOrders(startSort: number, count: number): number[] {
  const base = Number.isFinite(startSort) ? Math.max(0, Math.trunc(startSort)) : 0;
  return Array.from({ length: Math.max(0, Math.trunc(count)) }, (_, i) => base + i + 1);
}

export type SeedRowDraft = {
  name: string;
  slug: string;
  sortOrder: number;
};

/**
 * Build the final list of category rows to insert when an operator
 * adds a vertical: turns the registry's defaultCategorySeeds into
 * (name, slug, sortOrder) tuples, then drops any whose slug already
 * exists or collapsed to empty.
 *
 * Pure — caller wires the insert. Splitting this out means an action
 * can be a one-liner and the dedup logic gets a deterministic test.
 */
export function buildSeedDrafts(
  names: readonly string[],
  existingSlugs: ReadonlySet<string>,
  startSort: number,
): SeedRowDraft[] {
  const sortOrders = nextSortOrders(startSort, names.length);
  return names
    .map((name, idx) => ({
      name,
      slug: slugifyCategoryName(name),
      sortOrder: sortOrders[idx] ?? 0,
    }))
    .filter((row) => row.slug.length > 0 && !existingSlugs.has(row.slug));
}

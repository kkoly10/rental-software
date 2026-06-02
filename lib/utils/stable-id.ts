/**
 * Generate a stable identifier for keyed lists in client components.
 * Uses `crypto.randomUUID` where available (modern browsers + Node 19+) and
 * falls back to a base-36 string for older runtimes.
 *
 * Use this for `key={…}` on rendered lists when items can be added, removed,
 * or reordered — `key={index}` causes React to attach input state to the
 * DOM slot rather than the underlying item, producing "ghost" content.
 */
export function newStableId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

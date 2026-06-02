/**
 * Escape a user-supplied search string so it can be safely embedded in a
 * Postgres `LIKE` / `ILIKE` pattern. Without this, a user typing `%` or `_`
 * effectively gets a wildcard — and adversarially crafted inputs with
 * many wildcards become a regex-DoS vector.
 *
 * Backslash is also escaped because Postgres' standard_conforming_strings
 * is default-on and treats `\\` as a single backslash inside LIKE patterns.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

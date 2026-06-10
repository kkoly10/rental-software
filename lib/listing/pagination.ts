export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  query: string;
  /**
   * True when the underlying query FAILED — the empty `items` then
   * means "couldn't load", not "no rows". List pages must render an
   * error banner for this case instead of the no-data empty state,
   * otherwise operators see "you have no orders" during a transient
   * DB failure and panic. Optional so existing mock/demo callers
   * don't need changes.
   */
  loadFailed?: boolean;
};

export function normalizePage(value?: string | number | null) {
  // Use Number (not parseInt) so "3abc" is rejected rather than parsed as 3.
  const raw = typeof value === "number" ? value : Number(String(value ?? "1").trim());
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return Math.floor(raw);
}

export function normalizeQuery(value?: string | null) {
  return value?.trim() ?? "";
}

export function paginateItems<T>(
  items: T[],
  options?: { page?: string | number | null; pageSize?: number; query?: string | null }
): PaginatedResult<T> {
  const pageSize = options?.pageSize ?? 20;
  const currentPage = normalizePage(options?.page);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
    query: normalizeQuery(options?.query),
  };
}

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  query: string;
};

export function normalizePage(value?: string | number | null) {
  const raw = typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return raw;
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

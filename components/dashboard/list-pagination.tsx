import Link from "next/link";

function buildHref(pathname: string, query?: string, page?: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page && page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function ListPagination({
  pathname,
  page,
  totalPages,
  query,
}: {
  pathname: string;
  page: number;
  totalPages: number;
  query?: string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="order-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="muted">
          Page {page} of {totalPages}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={buildHref(pathname, query, page - 1)}
            className="ghost-btn"
            aria-disabled={page <= 1}
            style={page <= 1 ? { pointerEvents: "none", opacity: 0.5 } : undefined}
          >
            Previous
          </Link>
          <Link
            href={buildHref(pathname, query, page + 1)}
            className="secondary-btn"
            aria-disabled={page >= totalPages}
            style={page >= totalPages ? { pointerEvents: "none", opacity: 0.5 } : undefined}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}

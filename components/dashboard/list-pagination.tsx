import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

function buildHref(
  pathname: string,
  query?: string,
  page?: number,
  extraParams?: Record<string, string>
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  // Preserve any active filters (e.g. the Orders status chip) across pages.
  for (const [k, v] of Object.entries(extraParams ?? {})) {
    if (v) params.set(k, v);
  }
  if (page && page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export async function ListPagination({
  pathname,
  page,
  totalPages,
  query,
  extraParams,
}: {
  pathname: string;
  page: number;
  totalPages: number;
  query?: string;
  extraParams?: Record<string, string>;
}) {
  if (totalPages <= 1) {
    return null;
  }
  const m = await getMessages();

  return (
    <div className="order-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="muted">
          {page} / {totalPages}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={buildHref(pathname, query, page - 1, extraParams)}
            className="ghost-btn"
            aria-disabled={page <= 1}
            style={page <= 1 ? { pointerEvents: "none", opacity: 0.5 } : undefined}
          >
            {m.common.back}
          </Link>
          <Link
            href={buildHref(pathname, query, page + 1, extraParams)}
            className="secondary-btn"
            aria-disabled={page >= totalPages}
            style={page >= totalPages ? { pointerEvents: "none", opacity: 0.5 } : undefined}
          >
            {m.common.next}
          </Link>
        </div>
      </div>
    </div>
  );
}

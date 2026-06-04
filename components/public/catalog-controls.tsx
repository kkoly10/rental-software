"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/public/product-card";
import type { CatalogProduct } from "@/lib/types";

type SortKey = "default" | "price-asc" | "price-desc" | "name-asc";

/**
 * Storefront catalog with a client-side search + sort. Wraps the
 * existing CatalogGrid layout but adds:
 *
 *   - search input that filters name + description as the customer types
 *   - sort dropdown (default / price low → high / price high → low / A-Z)
 *   - "N matching" counter when search is active
 *   - "No matches" empty state with a "Clear search" reset
 *
 * Server-side filtering is intentionally avoided here so a customer
 * comparing options doesn't trigger a server round-trip on every
 * keystroke. The catalog rarely exceeds ~100 products per tenant; the
 * client filter is instant.
 */
function parsePrice(formatted: string): number {
  const match = formatted.match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  return parseFloat(match[1]);
}

export function CatalogControls({
  products,
  date,
  zip,
}: {
  products: CatalogProduct[];
  date?: string;
  zip?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("default");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = products;
    if (q) {
      out = out.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q),
      );
    }
    if (sort !== "default") {
      out = [...out];
      switch (sort) {
        case "price-asc":
          out.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
          break;
        case "price-desc":
          out.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
          break;
        case "name-asc":
          out.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }
    return out;
  }, [products, query, sort]);

  const isFiltered = query.trim().length > 0 || sort !== "default";

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "stretch",
          marginBottom: 16,
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rentals…"
          aria-label="Search rentals"
          style={{
            flex: "1 1 280px",
            minWidth: 0,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort rentals"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontSize: 14,
            background: "white",
          }}
        >
          <option value="default">Sort: featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name-asc">Name: A → Z</option>
        </select>
      </div>

      {isFiltered && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {filtered.length === 0
            ? "No matching rentals."
            : `${filtered.length} matching rental${filtered.length === 1 ? "" : "s"}`}
          {(query.trim() || sort !== "default") && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSort("default");
                }}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  color: "var(--primary)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: 13,
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-4">
        {filtered.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            slug={product.slug}
            price={product.price}
            category={product.category}
            description={product.description}
            status={product.status}
            imageUrl={product.imageUrl}
            date={date}
            zip={zip}
          />
        ))}
      </div>
    </div>
  );
}

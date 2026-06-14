"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/public/product-card";
import type { CatalogProduct } from "@/lib/types";

type SortKey = "default" | "price-asc" | "price-desc" | "name-asc";

/**
 * Storefront catalog with a client-side search + sort, editorial
 * styling. Adds:
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
  // "$1,250.00" → 1250.00 — strip currency symbols + thousands separators
  // before regexing out the digits so prices over $999 sort correctly.
  // Falls back to +Infinity (sorts last) when no parseable number found.
  const cleaned = formatted.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;
  return parseFloat(match[0]);
}

// Prefer the numeric headline rate from the loader; fall back to parsing the
// formatted string for any caller that didn't set priceCents.
function priceValue(p: CatalogProduct): number {
  return typeof p.priceCents === "number" ? p.priceCents : parsePrice(p.price);
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
          out.sort((a, b) => priceValue(a) - priceValue(b));
          break;
        case "price-desc":
          out.sort((a, b) => priceValue(b) - priceValue(a));
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
      <div className="st-catalog-controls">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rentals…"
          aria-label="Search rentals"
          className="st-catalog-search"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort rentals"
          className="st-catalog-sort"
        >
          <option value="default">Sort: featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name-asc">Name: A → Z</option>
        </select>
      </div>

      {isFiltered && (
        <div className="st-catalog-match-row">
          {filtered.length === 0
            ? "No matching rentals."
            : `${filtered.length} matching rental${filtered.length === 1 ? "" : "s"}`}
          {" · "}
          <button
            type="button"
            className="st-catalog-clear"
            onClick={() => {
              setQuery("");
              setSort("default");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="st-products-grid">
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

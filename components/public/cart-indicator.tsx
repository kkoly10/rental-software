"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/cart-context";

/**
 * Header cart link + item-count badge. The badge only renders after
 * hydration (cart lives in localStorage) so server and first client render
 * match. Lives in the storefront header chrome.
 */
export function CartIndicator({ label }: { label: string }) {
  const { count, hydrated } = useCart();
  return (
    <Link href="/cart" className="st-nav-cart" aria-label={label}>
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {hydrated && count > 0 && (
        <span className="st-nav-cart-badge" aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
}

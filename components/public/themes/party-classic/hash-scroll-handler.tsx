"use client";

import { useEffect } from "react";

/**
 * Compensates for the browser's flaky native fragment-scroll behavior
 * on the editorial storefront. Two specific failures this fixes:
 *
 *  1. `html { scroll-behavior: smooth }` from globals.css can be
 *     interrupted mid-animation by hydration-time layout shifts (the
 *     Leaflet map under #service-area dynamically imports + mounts
 *     after the browser has already begun its smooth scroll, and the
 *     animation gives up).
 *  2. Cross-page navigation (e.g. tap "Service Area" from /inventory
 *     in the mobile menu) does a full document load to /#service-area,
 *     but if any image/script load races the fragment scroll, the
 *     browser may settle at scrollY 0 anyway.
 *
 * Strategy: on mount, if window.location.hash is set, look up the
 * target on a short retry loop (because the element may not have
 * hydrated yet) and explicitly scrollIntoView with instant behavior
 * to bypass the smooth-scroll-interruption problem. Bails out on the
 * first successful scroll, or after 8 retries (~1.6s total).
 *
 * Same-page anchor clicks via next/link aren't affected by this — they
 * use the native smooth scroll which works fine for clicks initiated
 * after the page is fully hydrated.
 */
export function HashScrollHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    let attempts = 0;
    const maxAttempts = 8;
    const intervalMs = 200;

    const tryScroll = () => {
      attempts += 1;
      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (target) {
        // Bypass smooth-scroll — we want a guaranteed jump, not an
        // animation that might be interrupted.
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return true;
      }
      return false;
    };

    if (tryScroll()) return;

    const handle = window.setInterval(() => {
      if (tryScroll() || attempts >= maxAttempts) {
        window.clearInterval(handle);
      }
    }, intervalMs);

    return () => window.clearInterval(handle);
  }, []);

  return null;
}

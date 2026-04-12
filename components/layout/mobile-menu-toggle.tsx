"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

interface MobileMenuToggleProps {
  isOperator: boolean;
  siteUrl?: string;
}

export function MobileMenuToggle({ isOperator, siteUrl = "" }: MobileMenuToggleProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Focus trap
  useEffect(() => {
    if (!open || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const focusable = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    drawer.addEventListener("keydown", trapFocus);
    return () => drawer.removeEventListener("keydown", trapFocus);
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="mobile-menu-btn"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mounted && open && createPortal(
        <div className="mobile-menu-overlay" onClick={close}>
          <div
            ref={drawerRef}
            className="mobile-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">Menu</span>
              <button
                type="button"
                className="mobile-menu-close"
                aria-label="Close menu"
                onClick={close}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="mobile-menu-nav">
              <Link href="/inventory" onClick={close}>Catalog</Link>
              <Link href="/#how-it-works" onClick={close}>How It Works</Link>
              <Link href="/#service-area" onClick={close}>Service Area</Link>
              <Link href="/pricing" onClick={close}>Pricing</Link>
              <Link href="/order-status" onClick={close}>Order Status</Link>
              <Link href="/contact" onClick={close}>Contact</Link>
            </nav>

            <div className="mobile-menu-footer">
              <Link
                href="/inventory"
                className="primary-btn mobile-menu-cta"
                onClick={close}
              >
                Book Now
              </Link>
              {isOperator ? (
                <a href={`${siteUrl}/dashboard`} className="ghost-btn" onClick={close}>
                  Dashboard
                </a>
              ) : (
                <a href={`${siteUrl}/login`} className="ghost-btn" onClick={close}>
                  Rentals Login
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

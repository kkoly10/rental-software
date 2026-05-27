"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { LanguageSwitcher } from "./language-switcher";
import type { Locale } from "@/lib/i18n/config";
import { sanitizeHref } from "@/lib/utils/safe-href";

interface NavLink {
  key: string;
  label: string;
  href: string;
}

interface MobileMenuToggleProps {
  isOperator: boolean;
  siteUrl?: string;
  navLinks?: NavLink[];
  cta?: { label: string; href: string };
  authLabel?: string;
  dashboardLabel?: string;
  menuLabel?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  currentLocale?: Locale;
  languageLabel?: string;
}

const defaultLinks: NavLink[] = [
  { key: "catalog", label: "Catalog", href: "/inventory" },
  { key: "how_it_works", label: "How It Works", href: "/#how-it-works" },
  { key: "service_area", label: "Service Area", href: "/#service-area" },
  { key: "pricing", label: "Pricing", href: "/pricing" },
  { key: "order_status", label: "Order Status", href: "/order-status" },
  { key: "contact", label: "Contact", href: "/contact" },
];

export function MobileMenuToggle({
  isOperator,
  siteUrl = "",
  navLinks,
  cta,
  authLabel,
  dashboardLabel,
  menuLabel,
  openMenuLabel,
  closeMenuLabel,
  currentLocale,
  languageLabel,
}: MobileMenuToggleProps) {
  const links = navLinks ?? defaultLinks;
  const ctaHref = cta?.href ?? "/inventory";
  const ctaLabel = cta?.label ?? "Book Now";
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
        aria-label={openMenuLabel ?? "Open menu"}
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
            aria-label={menuLabel ?? "Navigation menu"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">{menuLabel ?? "Menu"}</span>
              <button
                type="button"
                className="mobile-menu-close"
                aria-label={closeMenuLabel ?? "Close menu"}
                onClick={close}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="mobile-menu-nav">
              {links.map((link) => (
                <Link key={link.key} href={sanitizeHref(link.href)} onClick={close}>{link.label}</Link>
              ))}
            </nav>

            <div className="mobile-menu-footer">
              {currentLocale && (
                <LanguageSwitcher currentLocale={currentLocale} ariaLabel={languageLabel} />
              )}
              <Link
                href={ctaHref}
                className="primary-btn mobile-menu-cta"
                onClick={close}
              >
                {ctaLabel}
              </Link>
              {isOperator ? (
                <a href={`${siteUrl}/dashboard`} className="ghost-btn" onClick={close}>
                  {dashboardLabel ?? "Dashboard"}
                </a>
              ) : (
                <a href={`${siteUrl}/login`} className="ghost-btn" onClick={close}>
                  {authLabel ?? "Rentals Login"}
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

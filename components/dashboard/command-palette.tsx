"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { dashboardNavItems } from "@/lib/navigation/dashboard-nav";

interface PaletteItem {
  id: string;
  label: string;
  href: string;
  section: "quick" | "navigation" | "recent";
  shortcut?: string;
}

const quickActions: PaletteItem[] = [
  { id: "qa-order", label: "Create Order", href: "/dashboard/orders?action=new", section: "quick", shortcut: "O" },
  { id: "qa-product", label: "Add Product", href: "/dashboard/products?action=new", section: "quick", shortcut: "P" },
  { id: "qa-deliveries", label: "View Deliveries", href: "/dashboard/deliveries", section: "quick", shortcut: "D" },
  { id: "qa-help", label: "Open Help Center", href: "/dashboard/help", section: "quick", shortcut: "?" },
];

const navigationItems: PaletteItem[] = dashboardNavItems.map((item) => ({
  id: `nav-${item.href}`,
  label: item.label,
  href: item.href,
  section: "navigation" as const,
}));

const RECENT_KEY = "command-palette-recent";

function loadRecent(): PaletteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PaletteItem[];
  } catch {
    return [];
  }
}

function saveRecent(item: PaletteItem) {
  try {
    const existing = loadRecent().filter((r) => r.id !== item.id);
    const next = [{ ...item, section: "recent" as const }, ...existing].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable
  }
}

function matchesQuery(label: string, query: string): boolean {
  const lower = label.toLowerCase();
  const q = query.toLowerCase();
  // substring match
  if (lower.includes(q)) return true;
  // fuzzy: all query chars appear in order
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentItems, setRecentItems] = useState<PaletteItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load recent items on open
  useEffect(() => {
    if (open) {
      setRecentItems(loadRecent());
    }
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build filtered list
  const allItems: PaletteItem[] = [];
  const filteredQuick = query
    ? quickActions.filter((item) => matchesQuery(item.label, query))
    : quickActions;
  const filteredNav = query
    ? navigationItems.filter((item) => matchesQuery(item.label, query))
    : navigationItems;
  const filteredRecent = query
    ? recentItems.filter((item) => matchesQuery(item.label, query))
    : recentItems;

  if (filteredRecent.length > 0) allItems.push(...filteredRecent);
  if (filteredQuick.length > 0) allItems.push(...filteredQuick);
  if (filteredNav.length > 0) allItems.push(...filteredNav);

  const selectItem = useCallback(
    (item: PaletteItem) => {
      saveRecent(item);
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  // Keyboard navigation inside palette
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[activeIndex]) {
        selectItem(allItems[activeIndex]);
      }
      return;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Reset index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function renderSection(label: string, items: PaletteItem[], startIndex: number) {
    if (items.length === 0) return null;
    return (
      <>
        <div className="cmd-palette-section">{label}</div>
        {items.map((item, i) => {
          const globalIndex = startIndex + i;
          return (
            <button
              key={item.id}
              type="button"
              className={`cmd-palette-item${globalIndex === activeIndex ? " cmd-palette-item-active" : ""}`}
              data-active={globalIndex === activeIndex}
              onMouseEnter={() => setActiveIndex(globalIndex)}
              onClick={() => selectItem(item)}
            >
              <span className="cmd-palette-item-label">{item.label}</span>
              {item.shortcut && <kbd className="cmd-palette-kbd">{item.shortcut}</kbd>}
            </button>
          );
        })}
      </>
    );
  }

  let offset = 0;
  const recentOffset = 0;
  offset += filteredRecent.length;
  const quickOffset = offset;
  offset += filteredQuick.length;
  const navOffset = offset;

  return (
    <div
      className="cmd-palette-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) setOpen(false);
      }}
    >
      <div className="cmd-palette">
        <div className="cmd-palette-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className="cmd-palette-esc">Esc</kbd>
        </div>

        <div className="cmd-palette-list" ref={listRef}>
          {allItems.length === 0 && (
            <div className="cmd-palette-empty">No results found</div>
          )}
          {renderSection("Recent", filteredRecent, recentOffset)}
          {renderSection("Quick Actions", filteredQuick, quickOffset)}
          {renderSection("Navigation", filteredNav, navOffset)}
        </div>
      </div>
    </div>
  );
}

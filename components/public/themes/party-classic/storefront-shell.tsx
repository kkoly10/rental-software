import { HashScrollHandler } from "./hash-scroll-handler";

/**
 * Wraps storefront page bodies in a min-height container; the theme tokens
 * themselves are scoped to body:not(:has(.sidebar-layout)) via
 * app/storefront-theme.css, which is loaded once from the root layout.
 *
 * Renders a "Skip to content" link as the very first focusable element so
 * keyboard users can bypass the header. The link is hidden until focused
 * (per the .st-skip-link CSS), then jumps to the page <main> by id.
 *
 * HashScrollHandler compensates for the browser's flaky native
 * fragment-scroll behavior on first paint — see its docstring.
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="st-shell">
      <a href="#main" className="st-skip-link">
        Skip to content
      </a>
      <HashScrollHandler />
      {children}
    </div>
  );
}

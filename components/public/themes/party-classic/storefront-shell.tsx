/**
 * Wraps storefront page bodies in a min-height container; the theme tokens
 * themselves are scoped to body:not(:has(.sidebar-layout)) via
 * app/storefront-theme.css, which is loaded once from the root layout.
 *
 * Kept as a thin wrapper so consumers can opt into shell-specific layout
 * behaviour (e.g. a sticky footer push) without affecting the CSS scoping.
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return <div className="st-shell">{children}</div>;
}

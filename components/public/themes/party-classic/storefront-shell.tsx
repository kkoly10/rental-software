import "@/app/storefront-theme.css";

/**
 * Wraps every storefront page in the party-classic theme so the CSS scoping
 * (body:has(.st-shell)) takes effect, the header/footer compose cleanly, and
 * brand tokens override defaults via BrandStyleInjector.
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return <div className="st-shell">{children}</div>;
}

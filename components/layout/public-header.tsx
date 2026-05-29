import { PartyClassicHeader } from "@/components/public/themes/party-classic/header";

/**
 * Compatibility shim — the historical PublicHeader is preserved as an
 * exported component so the ten consumer pages (inventory, checkout,
 * order-status, contact, pricing, privacy, terms, /not-found, etc.)
 * pick up the party-classic theme header without rewriting their
 * import lines.
 *
 * The optional logoUrl prop is preserved for type compatibility but
 * the theme component reads logo directly from brand settings, so the
 * prop is ignored.
 */
export async function PublicHeader(_props: { logoUrl?: string } = {}) {
  return <PartyClassicHeader />;
}

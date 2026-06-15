import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { listMarketedVerticals } from "@/lib/verticals/registry";

/**
 * Shared marketing-page footer. `verticalLinks` keeps the six
 * "<vertical> rental software" pages in the internal-link mesh from
 * every marketing surface that renders it.
 */
export async function MarketingFooter({
  verticalLinks = true,
}: {
  verticalLinks?: boolean;
}) {
  const { messages: m } = await getTranslator();
  const s = m.saasLanding;

  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-links">
          <a href="/#features">{s.nav.features}</a>
          <Link href="/pricing">{s.nav.pricing}</Link>
          <a href="/#faq">{s.nav.faq}</a>
          <Link href="/login">{s.nav.logIn}</Link>
          <Link href="/signup">{m.common.signUp}</Link>
          <a href="mailto:support@korent.app">{s.nav.contact}</a>
        </div>
        {verticalLinks && (
          <div className="mk-footer-verticals">
            {listMarketedVerticals().map((vertical) => (
              <Link key={vertical.slug} href={`/${vertical.marketing.landingPageSlug}`}>
                {vertical.label.en} rental software
              </Link>
            ))}
          </div>
        )}
        <div className="mk-footer-tagline">{s.footer.tagline}</div>
      </div>
    </footer>
  );
}

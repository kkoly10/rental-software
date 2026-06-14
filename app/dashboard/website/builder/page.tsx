import Link from "next/link";
import { headers } from "next/headers";
import { StorefrontBuilder } from "@/components/settings/storefront-builder";
import { getMessages } from "@/lib/i18n/server";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { loadBuilderDocument } from "@/lib/storefront/builder-load";
import { getDomainSettings } from "@/lib/data/domain-settings";
import { buildStorefrontUrl } from "@/lib/storefront/url";

export default async function StorefrontBuilderPage() {
  const m = await getMessages();
  const mb = m.dashboard.website.builder;

  // Pro gate — enforced on the page (the CTA is shown to everyone; the gate
  // lives here, not on visibility). Entry tiers get the upsell, not the editor.
  const gate = await checkFeatureAccess("storefront_builder");

  if (!gate.allowed) {
    return (
      <div style={{ maxWidth: 640, margin: "64px auto", padding: 24 }}>
        <Link href="/dashboard/website" className="secondary-btn">
          ← {mb.backToDashboard}
        </Link>
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="kicker">{mb.upsellTitle}</div>
          <h2 style={{ margin: "8px 0 12px" }}>{mb.upsellTitle}</h2>
          <p className="muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            {gate.reason ?? mb.upsellBody}
          </p>
          <Link href="/dashboard/settings/billing" className="primary-btn">
            {mb.upsellButton}
          </Link>
        </section>
      </div>
    );
  }

  // Allowed: load the builder document (existing draft/published or synthesized
  // from the operator's current settings) — org resolved via getOrgContext
  // (auth), NOT hostname. And resolve the public storefront URL for the
  // "Preview" link (opens in a new tab; no embedded iframe in this PR).
  const [{ document }, domainSettings, headersList] = await Promise.all([
    loadBuilderDocument(),
    getDomainSettings(),
    headers(),
  ]);
  const requestHost = headersList.get("host") ?? undefined;
  const storefrontUrl = buildStorefrontUrl(domainSettings, requestHost);

  return (
    <StorefrontBuilder initialDocument={document} storefrontUrl={storefrontUrl} />
  );
}

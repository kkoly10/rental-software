import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PublicFooter } from "@/components/public/public-footer";
import { StorefrontShell } from "@/components/public/themes/party-classic/storefront-shell";
import { PartyClassicHeader } from "@/components/public/themes/party-classic/header";
import { renderDocumentSections } from "@/components/public/themes/party-classic/render-document-sections";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { StorefrontEditorRuntime } from "@/components/settings/storefront-editor-runtime";
import { getMessages, getTranslator } from "@/lib/i18n/server";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { getOrgContext } from "@/lib/auth/org-context";
import { runWithPreviewOrgId } from "@/lib/auth/preview-org-context";
import { loadBuilderDocument } from "@/lib/storefront/builder-load";
import { getStorefrontPageDocument } from "@/lib/storefront/page-document";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getContentSettings } from "@/lib/data/content-settings";
import { getRequestOrigin } from "@/lib/seo/metadata";
import { organizationJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { getDomainSettings } from "@/lib/data/domain-settings";
import { buildStorefrontUrl } from "@/lib/storefront/url";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";

/**
 * On-canvas full-page storefront editor (PR-2a). The route IS the operator's
 * storefront, server-rendered as the editing canvas through the SAME shared
 * document renderer the live public page uses (so they can't drift) — but from
 * the DRAFT document and in `editable` mode, so unpublished edits show and each
 * section is wrapped in a `[data-st-section-id]` marker the client overlay reads.
 * The <StorefrontEditorRuntime> overlay provides all editing chrome (top bar,
 * hover/selection frames, per-section toolbar, content/styles drawers,
 * save/publish). Nothing here changes backend/document logic.
 *
 * SECURITY (mirrors the preview route, no IDOR):
 *  - Org comes from getOrgContext() (AUTH) — never a query param/user input.
 *  - Pro gate enforced here (upsell shown to entry tiers; the write actions also
 *    re-check it server-side, defense in depth).
 *  - The dashboard host can't resolve the operator's org via the hostname tenant
 *    resolver, so the whole storefront render runs inside
 *    runWithPreviewOrgId(orgId): every nested storefront loader resolves to the
 *    operator's org through AsyncLocalStorage.
 */
export const dynamic = "force-dynamic";

export default async function StorefrontBuilderPage() {
  const m = await getMessages();
  const mb = m.dashboard.website.builder;

  // Pro gate — the CTA is shown to everyone; entry tiers get the upsell, not the
  // editor. Kept exactly as the previous builder page.
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

  // Org from AUTH, never from user input.
  const ctx = await getOrgContext();
  if (!ctx) notFound();

  // Resolve the public storefront URL for the "Preview" link (new tab).
  const [domainSettings, headersList] = await Promise.all([
    getDomainSettings(),
    headers(),
  ]);
  const storefrontUrl = buildStorefrontUrl(
    domainSettings,
    headersList.get("host") ?? undefined
  );

  // Render the storefront canvas exactly like the preview route, but from the
  // DRAFT document and in `editable` mode. All nested loaders resolve to the
  // operator's org via runWithPreviewOrgId.
  return runWithPreviewOrgId(ctx.organizationId, async () => {
    const [featured, settings, contentSettings, origin, { messages }, draftDoc] =
      await Promise.all([
        getFeaturedCatalogList(),
        getOrganizationSettings(),
        getContentSettings(),
        getRequestOrigin(),
        getTranslator(),
        // The editor edits unpublished work → the DRAFT document.
        getStorefrontPageDocument("draft"),
      ]);

    // Draft → published → synthesized default (reuse builder-load) so the canvas
    // is never blank — same fallback chain as the preview route.
    let doc: StorefrontPageDocument | null = draftDoc;
    if (!doc) doc = await getStorefrontPageDocument("published");
    if (!doc) doc = (await loadBuilderDocument()).document;

    const msg = messages;
    const vis = contentSettings.sectionVisibility;
    const faqItems =
      contentSettings.customFaq && contentSettings.customFaq.length > 0
        ? contentSettings.customFaq
        : msg.storefront.faq.defaults.map((f) => ({
            question: f.question,
            answer: f.answer,
          }));

    return (
      <>
        {/* Server-rendered storefront = the editing canvas. Offset below the
            fixed editor top bar via .st-editor-canvas. */}
        <div className="st-editor-canvas">
          <StorefrontShell>
            <PartyClassicHeader />
            <JsonLdScript
              data={organizationJsonLd(
                {
                  ...settings,
                  websiteMessage: settings.websiteMessage || undefined,
                },
                origin
              )}
            />
            {vis.faq_section !== false && <JsonLdScript data={faqJsonLd(faqItems)} />}

            <main id="main">
              {renderDocumentSections(
                doc,
                { featured, contentSettings, messages: msg, faqItems },
                { editable: true }
              )}

              <PublicFooter />
            </main>
          </StorefrontShell>
        </div>

        {/* Client editing chrome overlay. */}
        <StorefrontEditorRuntime
          initialDocument={doc}
          storefrontUrl={storefrontUrl}
        />
      </>
    );
  });
}

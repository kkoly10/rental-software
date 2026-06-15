import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/public/public-footer";
import { StorefrontShell } from "@/components/public/themes/party-classic/storefront-shell";
import { PartyClassicHeader } from "@/components/public/themes/party-classic/header";
import { renderDocumentSections } from "@/components/public/themes/party-classic/render-document-sections";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getContentSettings } from "@/lib/data/content-settings";
import { getRequestOrigin } from "@/lib/seo/metadata";
import { organizationJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { getTranslator } from "@/lib/i18n/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { runWithPreviewOrgId } from "@/lib/auth/preview-org-context";
import { getStorefrontPageDocument } from "@/lib/storefront/page-document";
import { loadBuilderDocument } from "@/lib/storefront/builder-load";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";

/**
 * Builder live-preview canvas (PR-1f). Loaded in a same-origin <iframe> from the
 * full-screen builder; renders the operator's storefront through the SAME shared
 * document renderer the live public page uses (so the two can't drift), but from
 * the DRAFT document, so unpublished edits show.
 *
 * SECURITY:
 *  - The org comes from getOrgContext() (AUTH) — never a query param/user input,
 *    so there's no IDOR. Wrong/missing org → notFound().
 *  - Pro gate re-checked here (defense in depth; the builder page gates too).
 *  - The hostname tenant resolver can't resolve the operator's org on the
 *    dashboard host, so the whole render runs inside runWithPreviewOrgId(orgId),
 *    which installs the AUTH-resolved org id in an AsyncLocalStorage store that
 *    getPublicOrgId() honours. AsyncLocalStorage propagates through the awaited
 *    RSC render, so every nested storefront loader (organization-settings,
 *    content-settings, page-document, …) resolves to the operator's org.
 *
 * Full-bleed: no dashboard chrome — it lives inside an iframe.
 */
export const dynamic = "force-dynamic";

export default async function StorefrontBuilderPreviewPage() {
  // Org from AUTH, never from user input.
  const ctx = await getOrgContext();
  if (!ctx) notFound();

  // Defense-in-depth Pro gate (the builder page gates too).
  if (!(await checkFeatureAccess("storefront_builder")).allowed) notFound();

  return runWithPreviewOrgId(ctx.organizationId, async () => {
    // Inside the override, every storefront loader below resolves to the
    // operator's org (getPublicOrgId returns the override).
    const [featured, settings, contentSettings, origin, { messages }, draftDoc] =
      await Promise.all([
        getFeaturedCatalogList(),
        getOrganizationSettings(),
        getContentSettings(),
        getRequestOrigin(),
        getTranslator(),
        // Preview shows unpublished edits → the DRAFT document.
        getStorefrontPageDocument("draft"),
      ]);

    // If no draft, fall back to published; else synthesize the default document
    // (reuse builder-load) so the canvas is never blank.
    let doc: StorefrontPageDocument | null = draftDoc;
    if (!doc) doc = await getStorefrontPageDocument("published");
    if (!doc) doc = (await loadBuilderDocument()).document;

    const m = messages;
    const vis = contentSettings.sectionVisibility;
    const faqItems =
      contentSettings.customFaq && contentSettings.customFaq.length > 0
        ? contentSettings.customFaq
        : m.storefront.faq.defaults.map((f) => ({
            question: f.question,
            answer: f.answer,
          }));

    // SAME storefront shell + header + shared document renderer + footer as the
    // public page's document path.
    return (
      <StorefrontShell>
        <PartyClassicHeader />
        <JsonLdScript
          data={organizationJsonLd(
            { ...settings, websiteMessage: settings.websiteMessage || undefined },
            origin
          )}
        />
        {vis.faq_section !== false && <JsonLdScript data={faqJsonLd(faqItems)} />}

        <main id="main">
          {renderDocumentSections(doc, {
            featured,
            contentSettings,
            messages: m,
            faqItems,
          })}

          <PublicFooter />
        </main>
      </StorefrontShell>
    );
  });
}

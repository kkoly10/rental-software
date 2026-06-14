import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StorefrontTokenEditor } from "@/components/settings/storefront-token-editor";
import { getMessages } from "@/lib/i18n/server";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import {
  resolveEditorTokens,
  DEFAULT_THEME_TOKENS,
} from "@/lib/data/storefront-token-defaults";

export default async function StorefrontBuilderPage() {
  const m = await getMessages();
  const mb = m.dashboard.website.builder;

  // Pro gate — enforced on the page (the CTA is shown to everyone; the gate
  // lives here, not on visibility). Entry tiers get the upsell, not the editor.
  const gate = await checkFeatureAccess("storefront_builder");

  if (!gate.allowed) {
    return (
      <DashboardShell title={mb.title} description={mb.description}>
        <section className="panel" style={{ maxWidth: 560 }}>
          <div className="kicker">{mb.upsellTitle}</div>
          <h2 style={{ margin: "8px 0 12px" }}>{mb.upsellTitle}</h2>
          <p className="muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            {gate.reason ?? mb.upsellBody}
          </p>
          <Link href="/dashboard/settings/billing" className="primary-btn">
            {mb.upsellButton}
          </Link>
        </section>
      </DashboardShell>
    );
  }

  // Allowed: seed the editor with draft → published → defaults.
  let initialTokens = DEFAULT_THEME_TOKENS;
  if (hasSupabaseEnv()) {
    const ctx = await getOrgContext();
    if (ctx) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("storefront_pages")
        .select("draft, published")
        .eq("organization_id", ctx.organizationId)
        .eq("page_key", "home")
        .maybeSingle();

      const draft = data?.draft as Record<string, unknown> | null;
      const published = data?.published as Record<string, unknown> | null;
      initialTokens = resolveEditorTokens(draft?.theme, published?.theme);
    }
  }

  return (
    <DashboardShell title={mb.title} description={mb.description}>
      <section className="panel">
        <StorefrontTokenEditor initialTokens={initialTokens} />
      </section>
    </DashboardShell>
  );
}

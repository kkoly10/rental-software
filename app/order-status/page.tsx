import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { OrderLookupForm } from "@/components/portal/order-lookup-form";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { lookupOrderByPortalToken } from "@/lib/portal/lookup";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getMessages } from "@/lib/i18n/server";
import { getPublicPrimaryVerticalSlug } from "@/lib/verticals/storefront-defaults";
import { isGeneralVertical } from "@/lib/verticals/customer-language";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrganizationSettings();
  return await buildPageMetadata({
    title: `Order Status — ${settings.businessName}`,
    description: "View your rental order, documents, and balance through your secure portal link.",
    path: "/order-status",
    siteName: settings.businessName,
    noIndex: true,
  });
}

export default async function OrderStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await requirePublicOrg();

  const { token } = await searchParams;
  const [initialState, m, verticalSlug] = await Promise.all([
    token ? lookupOrderByPortalToken(token) : Promise.resolve(undefined),
    getMessages(),
    getPublicPrimaryVerticalSlug(),
  ]);
  // General ("other") rentals (tools, AV, furniture) aren't weather-bound —
  // suppress the "check weather for your event day" note for them.
  const general = isGeneralVertical(verticalSlug);

  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="centered-stack-lg">
            <div className="kicker">{m.nav.orderStatus}</div>
            <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
              {m.orderStatus.title}
            </h1>
            <p className="muted">
              {m.orderStatus.description}
            </p>
          </div>

          <OrderLookupForm initialState={initialState} isGeneral={general} />
        </div>
      </main>

      <PublicFooter />
    </>
  );
}

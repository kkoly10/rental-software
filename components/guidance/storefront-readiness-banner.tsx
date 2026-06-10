import Link from "next/link";
import { hasStripeEnv } from "@/lib/stripe/config";
import { getMessages } from "@/lib/i18n/server";

/**
 * Tier-1 launch fix — loud, non-dismissible warning when the
 * storefront LOOKS live but can't actually take a booking.
 *
 * The setup checklist (SetupChecklistCard) nudges new operators
 * through the happy path, but it's dismissible and collapsible —
 * and it never says the quiet part: with active products and ZERO
 * service areas, every customer checkout is rejected with "We do
 * not currently serve that delivery area." The operator thinks
 * they're live; every booking attempt silently dies.
 *
 * Renders nothing when the storefront is actually bookable.
 * Server component — the data comes from the guidance snapshot the
 * dashboard home already loads.
 */
export async function StorefrontReadinessBanner({
  productsCount,
  serviceAreasCount,
}: {
  productsCount: number;
  serviceAreasCount: number;
}) {
  const m = await getMessages();
  const t = m.dashboard.storefrontReadiness;

  const storefrontDead = productsCount > 0 && serviceAreasCount === 0;
  const depositsOff = !hasStripeEnv();

  if (!storefrontDead && !depositsOff) return null;

  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
      {storefrontDead && (
        <div
          role="alert"
          className="panel"
          style={{
            padding: "14px 18px",
            borderLeft: "4px solid #dc2626",
            background: "var(--surface-muted)",
          }}
        >
          <strong>{t.noServiceAreaTitle}</strong>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
            {t.noServiceAreaBody}
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href="/dashboard/service-areas" className="primary-btn" style={{ fontSize: 13 }}>
              {t.noServiceAreaCta}
            </Link>
          </div>
        </div>
      )}
      {depositsOff && (
        <div
          className="panel"
          style={{
            padding: "12px 18px",
            borderLeft: "4px solid #f59e0b",
            background: "var(--surface-muted)",
          }}
        >
          <strong>{t.depositsOffTitle}</strong>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
            {t.depositsOffBody}
          </div>
        </div>
      )}
    </div>
  );
}

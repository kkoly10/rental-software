import { hasSupabaseEnv } from "@/lib/env";
import { hasStripeEnv } from "@/lib/stripe/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  deriveConnectStatus,
  fieldsFromOrgRow,
  ORG_CONNECT_COLUMNS,
  type ConnectStatus,
} from "@/lib/stripe/connect";
import { StripeConnectButtons } from "@/components/settings/stripe-connect-buttons";
import { getMessages } from "@/lib/i18n/server";

/**
 * Connect Express status card on Settings → Billing.
 *
 * Renders the operator's payment-readiness from the mirrored org
 * columns (no live Stripe call in the render path) and the action
 * buttons for the current state. Read-only for non-admins — the
 * server actions enforce the role; hiding the buttons here is just
 * politeness, so we don't bother re-deriving role client-side.
 */
export async function StripeConnectCard() {
  if (!hasStripeEnv()) return null;
  const m = await getMessages();
  const t = m.dashboard.stripeConnect;

  let status: ConnectStatus = "not_connected";
  let payoutsEnabled = false;

  if (hasSupabaseEnv()) {
    const ctx = await getOrgContext();
    if (!ctx) return null;
    const supabase = await createSupabaseServerClient();
    const { data: org } = await supabase
      .from("organizations")
      .select(ORG_CONNECT_COLUMNS)
      .eq("id", ctx.organizationId)
      .maybeSingle();
    const fields = fieldsFromOrgRow(org ?? null);
    status = deriveConnectStatus(fields);
    payoutsEnabled = fields.payoutsEnabled;
  }

  const statusCopy: Record<ConnectStatus, { label: string; body: string; tone: string }> = {
    not_connected: {
      label: t.statusNotConnected,
      body: t.bodyNotConnected,
      tone: "#f59e0b",
    },
    onboarding_incomplete: {
      label: t.statusIncomplete,
      body: t.bodyIncomplete,
      tone: "#f59e0b",
    },
    pending_verification: {
      label: t.statusPending,
      body: t.bodyPending,
      tone: "#3b82f6",
    },
    ready: {
      label: t.statusReady,
      body: payoutsEnabled ? t.bodyReady : t.bodyReadyPayoutsPending,
      tone: "#16a34a",
    },
  };

  const c = statusCopy[status];

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="section-header">
        <div>
          <div className="kicker">{t.kicker}</div>
          <h2 style={{ margin: "6px 0 0" }}>{t.title}</h2>
        </div>
        <span
          className="badge"
          style={{ borderColor: c.tone, color: c.tone, fontWeight: 600 }}
        >
          {c.label}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        {c.body}
      </p>
      <StripeConnectButtons
        status={status}
        labels={{
          connect: t.ctaConnect,
          resume: t.ctaResume,
          opening: t.ctaOpening,
          checkStatus: t.ctaCheckStatus,
          checking: t.ctaChecking,
          openDashboard: t.ctaOpenDashboard,
        }}
      />
    </section>
  );
}

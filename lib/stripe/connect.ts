import type Stripe from "stripe";

/**
 * Stripe Connect Express — status model for operator payments.
 *
 * The dashboard renders the operator's payment-readiness from the
 * columns mirrored onto organizations (synced on onboarding return,
 * manual refresh, and the account.updated webhook) so no live Stripe
 * call sits in the page render path.
 *
 * State machine (in display order of the operator's journey):
 *   not_connected         — no acct_xxx yet; show "Connect with Stripe"
 *   onboarding_incomplete — account created but the operator bailed
 *                           out of the Stripe-hosted form; show
 *                           "Resume onboarding"
 *   pending_verification  — form submitted, Stripe still reviewing
 *                           (charges_enabled=false); nothing to do
 *                           but wait — surface that explicitly so
 *                           the operator doesn't re-submit
 *   ready                 — charges_enabled; checkout collects
 *                           deposits into the operator's account.
 *                           payouts_enabled may still lag (bank
 *                           verification) — that's a sub-state the
 *                           card notes but doesn't block on.
 */
export type ConnectStatus =
  | "not_connected"
  | "onboarding_incomplete"
  | "pending_verification"
  | "ready";

export type ConnectAccountFields = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export function deriveConnectStatus(fields: ConnectAccountFields): ConnectStatus {
  if (!fields.accountId) return "not_connected";
  if (fields.chargesEnabled) return "ready";
  if (!fields.detailsSubmitted) return "onboarding_incomplete";
  return "pending_verification";
}

/** True when the storefront checkout may create a Stripe session for
 *  this org. Direct charges require a verified connected account —
 *  the platform key alone is no longer sufficient. */
export function canAcceptStripePayments(fields: ConnectAccountFields): boolean {
  return deriveConnectStatus(fields) === "ready";
}

/** Map a Stripe Account object onto the organizations columns. Kept
 *  pure so the webhook handler, the return route, and the manual
 *  refresh action all write identical shapes. */
export function connectColumnsFromAccount(account: {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
}): {
  stripe_connect_account_id: string;
  stripe_connect_charges_enabled: boolean;
  stripe_connect_payouts_enabled: boolean;
  stripe_connect_details_submitted: boolean;
} {
  return {
    stripe_connect_account_id: account.id,
    stripe_connect_charges_enabled: Boolean(account.charges_enabled),
    stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_connect_details_submitted: Boolean(account.details_submitted),
  };
}

export type OrgConnectRow = {
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

/** Shared select-list for the connect mirror columns — checkout, the
 *  readiness banner, and the settings card must always read the same
 *  set, or a future column addition would desync their status. */
export const ORG_CONNECT_COLUMNS =
  "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted";

export function fieldsFromOrgRow(row: OrgConnectRow | null): ConnectAccountFields {
  return {
    accountId: row?.stripe_connect_account_id ?? null,
    chargesEnabled: Boolean(row?.stripe_connect_charges_enabled),
    payoutsEnabled: Boolean(row?.stripe_connect_payouts_enabled),
    detailsSubmitted: Boolean(row?.stripe_connect_details_submitted),
  };
}

/** Sync a freshly-retrieved Stripe account onto the org row.
 *  `client` must be able to write organizations (admin client or an
 *  owner/admin session). Sets onboarded_at the first time charges
 *  flip on so the dashboard can show "accepting payments since…". */
export async function syncConnectAccountToOrg(
  client: {
    from: (table: string) => any;
  },
  organizationId: string,
  account: Stripe.Account
): Promise<void> {
  const columns = connectColumnsFromAccount(account);
  const update: Record<string, unknown> = { ...columns };
  if (columns.stripe_connect_charges_enabled) {
    // COALESCE-style: only stamp onboarded_at if not already set.
    // Supabase update can't express that directly, so read-modify is
    // avoided by letting the timestamp be idempotent-ish: re-stamping
    // on every sync would lie about the original date, so guard it.
    const { data: existing } = await client
      .from("organizations")
      .select("stripe_connect_onboarded_at")
      .eq("id", organizationId)
      .maybeSingle();
    if (!existing?.stripe_connect_onboarded_at) {
      update.stripe_connect_onboarded_at = new Date().toISOString();
    }
  }
  await client.from("organizations").update(update).eq("id", organizationId);
}

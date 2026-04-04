"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";

export type DeleteAccountState = {
  ok: boolean;
  message: string;
};

/**
 * Soft-deletes the user's organization and signs them out.
 * - Cancels any active Stripe subscription
 * - Marks the organization as deleted (soft-delete with 30-day grace period)
 * - Deactivates all memberships
 * - Signs out the user
 */
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Demo mode: account deletion is not available." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to delete your account." };
  }

  // Rate limiting: 3 attempts per hour per user
  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "account:delete:user",
        actor: ctx.userId,
        limit: 3,
        windowSeconds: 3600,
      }),
      enforceRateLimit({
        scope: "account:delete:client",
        actor: clientKey,
        limit: 3,
        windowSeconds: 3600,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait before trying again." };
    }
  } catch {
    return { ok: false, message: "Unable to process request right now." };
  }

  // Verify confirmation text
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "DELETE") {
    return { ok: false, message: "Please type DELETE to confirm account deletion." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify user is an owner of the organization
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("profile_id", ctx.userId)
    .eq("organization_id", ctx.organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return { ok: false, message: "Only the account owner can delete the organization." };
  }

  try {
    // 1. Cancel Stripe subscription if active
    if (hasStripeEnv()) {
      const { data: org } = await supabase
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", ctx.organizationId)
        .maybeSingle();

      if (org?.stripe_customer_id) {
        try {
          const stripe = getStripe();
          const subscriptions = await stripe.subscriptions.list({
            customer: org.stripe_customer_id,
            status: "active",
            limit: 10,
          });

          for (const sub of subscriptions.data) {
            await stripe.subscriptions.cancel(sub.id, {
              prorate: true,
            });
          }
        } catch (stripeError) {
          await logAppError({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            source: "account.delete",
            message: "Failed to cancel Stripe subscription during account deletion",
            stack: stripeError instanceof Error ? stripeError.stack : undefined,
          });
          // Continue with deletion even if Stripe cancel fails — operator can resolve manually
        }
      }
    }

    // 2. Soft-delete the organization
    const { error: orgError } = await supabase
      .from("organizations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ctx.organizationId);

    if (orgError) {
      await logAppError({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        source: "account.delete",
        message: "Failed to soft-delete organization",
        context: { error: orgError.message },
      });
      return { ok: false, message: "Failed to delete account. Please try again or contact support." };
    }

    // 3. Deactivate all memberships for this organization
    await supabase
      .from("organization_memberships")
      .update({ status: "inactive" })
      .eq("organization_id", ctx.organizationId);

    await logAppEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      source: "account.delete",
      action: "account_deleted",
      status: "success",
    });

    // 4. Sign out
    await supabase.auth.signOut();
  } catch (error) {
    await logAppError({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      source: "account.delete",
      message: "Account deletion failed unexpectedly",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, message: "An unexpected error occurred. Please try again." };
  }

  redirect("/login?deleted=true");
}

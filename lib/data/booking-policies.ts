import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";

export type BookingPolicies = {
  depositPercentage: number;
  depositMinimum: number | null;
  requireDepositToConfirm: boolean;
  cancellationPolicyText: string | null;
  bookingLeadTimeHours: number;
  maxAdvanceBookingDays: number;
};

const DEFAULTS: BookingPolicies = {
  depositPercentage: 30,
  depositMinimum: null,
  requireDepositToConfirm: true,
  cancellationPolicyText: null,
  bookingLeadTimeHours: 24,
  maxAdvanceBookingDays: 180,
};

/**
 * Fetch booking policies for the current org (dashboard or public storefront).
 * Returns sensible defaults if not configured.
 *
 * Wrapped in React cache() so callers in the same request (e.g. the checkout
 * page loader and the pricing helper) share a single DB round trip.
 */
export const getBookingPolicies = cache(async (): Promise<BookingPolicies> => {
  if (!hasSupabaseEnv()) return DEFAULTS;

  const organizationId = await getPublicOrgId();
  if (!organizationId) return DEFAULTS;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return DEFAULTS;

  const settings = (data.settings as Record<string, unknown>) ?? {};

  return {
    depositPercentage: clampNumber(settings.deposit_percentage, 0, 100, DEFAULTS.depositPercentage),
    depositMinimum: typeof settings.deposit_minimum === "number" ? settings.deposit_minimum : DEFAULTS.depositMinimum,
    requireDepositToConfirm: typeof settings.require_deposit_to_confirm === "boolean" ? settings.require_deposit_to_confirm : DEFAULTS.requireDepositToConfirm,
    cancellationPolicyText: typeof settings.cancellation_policy_text === "string" && settings.cancellation_policy_text ? settings.cancellation_policy_text : DEFAULTS.cancellationPolicyText,
    bookingLeadTimeHours: clampNumber(settings.booking_lead_time_hours, 0, 720, DEFAULTS.bookingLeadTimeHours),
    maxAdvanceBookingDays: clampNumber(settings.max_advance_booking_days, 1, 730, DEFAULTS.maxAdvanceBookingDays),
  };
});

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

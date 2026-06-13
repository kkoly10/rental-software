"use server";

import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";
import { hasSupabaseEnv } from "@/lib/env";
import {
  DEFAULT_METRO_SLUG,
  getWorld,
  metroBySlug,
} from "@/lib/market/registry";

/**
 * Renter-facing marketplace actions: waitlist joins and demand-event
 * logging (spec §31 graduation-gate inputs). Both write service-role
 * tables (no client policies — emails are PII, demand metrics are
 * internal), so they go through the admin client after rate limiting.
 */

export type WaitlistState = { ok: boolean; message: string };

const waitlistSchema = z.object({
  email: z.string().email("Enter a valid email."),
  worldSlug: z.string().min(1),
  metroSlug: z.string().min(1).default(DEFAULT_METRO_SLUG),
});

export async function joinWorldWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = waitlistSchema.safeParse({
    email: formData.get("email"),
    worldSlug: formData.get("worldSlug"),
    metroSlug: formData.get("metroSlug") ?? DEFAULT_METRO_SLUG,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const world = getWorld(parsed.data.worldSlug);
  if (!world) return { ok: false, message: "Unknown world." };
  if (!metroBySlug.has(parsed.data.metroSlug)) {
    return { ok: false, message: "Unknown metro." };
  }
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Waitlist is unavailable right now. Please try again later." };
  }

  const clientKey = await getActionClientKey();
  try {
    const limit = await enforceRateLimit({
      scope: "market:waitlist",
      actor: clientKey,
      limit: 10,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) {
      return { ok: false, message: "Too many attempts. Please try again later." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now. Please try again shortly." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("market_world_waitlist").insert({
    world_slug: parsed.data.worldSlug,
    metro_slug: parsed.data.metroSlug,
    email: parsed.data.email.toLowerCase(),
  });

  // Unique violation = already on the list; treat as success so the
  // form never leaks whether an email is present.
  if (error && error.code !== "23505") {
    return { ok: false, message: "Couldn't save that — please try again." };
  }

  if (!error) {
    await admin.from("market_demand_events").insert({
      kind: "waitlist_join",
      world_slug: parsed.data.worldSlug,
      metro_slug: parsed.data.metroSlug,
    });
  }

  return {
    ok: true,
    message: `You're on the list — we'll email you when ${world.label} opens in your metro.`,
  };
}

type DemandEventInput = {
  kind: "search" | "world_view" | "category_view" | "listing_view";
  worldSlug?: string;
  categorySlug?: string;
  metroSlug?: string;
  query?: string;
  listingId?: string;
  /** Phase 2: number of results the search returned (null for views).
   *  0 marks a zero-result search — the strongest demand signal. */
  resultCount?: number;
};

/**
 * Fire-and-forget demand logging from server components. Never throws;
 * a metrics failure must never break a page render. Rate limiting is
 * intentionally loose (these are page-view-shaped events) but present
 * so a curl loop can't flood the table.
 */
export async function logDemandEvent(input: DemandEventInput): Promise<void> {
  try {
    if (!hasSupabaseEnv()) return;
    if (input.worldSlug && !getWorld(input.worldSlug)) return;

    const clientKey = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:demand",
      actor: clientKey,
      limit: 120,
      windowSeconds: 300,
      strict: false,
    });
    if (!limit.allowed) return;

    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    const admin = createSupabaseAdminClient();
    await admin.from("market_demand_events").insert({
      kind: input.kind,
      world_slug: input.worldSlug ?? null,
      category_slug: input.categorySlug ?? null,
      metro_slug: input.metroSlug ?? DEFAULT_METRO_SLUG,
      query: input.query?.slice(0, 200) ?? null,
      listing_id: input.listingId ?? null,
      result_count: input.resultCount ?? null,
    });
  } catch {
    // Swallow — demand metrics are best-effort by design.
  }
}

/**
 * Phase 2 demand capture (build tracker, research rule #1: demand is
 * the scarce side). A renter — or an anonymous visitor on a no-results
 * or coming-soon page — tells us what they need. Service-role write
 * (PII), rate-limited. Doubles as the channel for service requests
 * (photographer/DJ), which feed the operated-rentals decision.
 */
export type DemandRequestState = { ok: boolean; message: string };

const demandRequestSchema = z.object({
  query: z.string().trim().min(1, "Tell us what you're looking for.").max(300),
  email: z.string().email("Enter a valid email."),
  worldSlug: z.string().max(64).optional().or(z.literal("")),
  categorySlug: z.string().max(64).optional().or(z.literal("")),
  metroSlug: z.string().min(1).default(DEFAULT_METRO_SLUG),
  zipCode: z.string().max(12).optional().or(z.literal("")),
  neededStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  neededEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  deliveryRequired: z.coerce.boolean().default(false),
  budgetDollars: z.coerce.number().min(0).max(1_000_000).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  sourcePage: z.string().max(120).optional().or(z.literal("")),
});

export async function submitDemandRequest(
  _prev: DemandRequestState,
  formData: FormData,
): Promise<DemandRequestState> {
  const parsed = demandRequestSchema.safeParse({
    query: formData.get("query"),
    email: formData.get("email"),
    worldSlug: formData.get("world_slug") ?? "",
    categorySlug: formData.get("category_slug") ?? "",
    metroSlug: formData.get("metro_slug") || DEFAULT_METRO_SLUG,
    zipCode: formData.get("zip_code") ?? "",
    neededStartDate: formData.get("needed_start_date") ?? "",
    neededEndDate: formData.get("needed_end_date") ?? "",
    deliveryRequired: formData.get("delivery_required") ? true : false,
    budgetDollars: formData.get("budget") || undefined,
    notes: formData.get("notes") ?? "",
    sourcePage: formData.get("source_page") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Unavailable right now — please try again later." };
  }
  if (parsed.data.metroSlug && !metroBySlug.has(parsed.data.metroSlug)) {
    return { ok: false, message: "Unknown metro." };
  }

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:demand-request",
      actor: key,
      limit: 8,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) {
      return { ok: false, message: "Too many requests — please try again later." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now — try again shortly." };
  }

  // Link the request to the signed-in renter when there is one (helps
  // notify them later); anonymous submissions are allowed.
  let renterProfileId: string | null = null;
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    renterProfileId = user?.id ?? null;
  } catch {
    renterProfileId = null;
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("market_demand_requests").insert({
    renter_profile_id: renterProfileId,
    world_slug: parsed.data.worldSlug || null,
    category_slug: parsed.data.categorySlug || null,
    query: parsed.data.query,
    metro_slug: parsed.data.metroSlug,
    zip_code: parsed.data.zipCode || null,
    needed_start_date: parsed.data.neededStartDate || null,
    needed_end_date: parsed.data.neededEndDate || null,
    delivery_required: parsed.data.deliveryRequired,
    budget_cents:
      parsed.data.budgetDollars !== undefined
        ? Math.round(parsed.data.budgetDollars * 100)
        : null,
    email: parsed.data.email.toLowerCase(),
    notes: parsed.data.notes || null,
    source_page: parsed.data.sourcePage || null,
  });
  if (error) {
    return { ok: false, message: "Couldn't save that — please try again." };
  }

  return {
    ok: true,
    message:
      "Got it — we'll email you the moment something matching turns up. Thanks for telling us what you need.",
  };
}

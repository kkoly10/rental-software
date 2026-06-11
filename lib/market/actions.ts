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
    });
  } catch {
    // Swallow — demand metrics are best-effort by design.
  }
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Marketplace support channel (§19) + the dedicated marketplace
 * sign-in. Support requests work signed-in or out and land in the
 * platform-admin trust queue at /dashboard/market-admin.
 */

export type SupportState = { ok: boolean; message: string };

const supportSchema = z.object({
  email: z.string().email("Enter a valid email so we can reply."),
  topic: z.enum(["booking", "payment", "listing", "account", "other"]),
  message: z.string().min(10, "Tell us a bit more (at least 10 characters).").max(2000),
  bookingId: z.string().uuid().optional().or(z.literal("")),
});

export async function submitSupportRequest(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Support is unavailable right now." };

  const parsed = supportSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    topic: formData.get("topic") ?? "other",
    message: String(formData.get("message") ?? "").trim(),
    bookingId: formData.get("booking_id") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:support",
      actor: key,
      limit: 5,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many requests — try again later." };
  } catch {
    return { ok: false, message: "Try again shortly." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("market_support_requests").insert({
    profile_id: user?.id ?? null,
    email: parsed.data.email,
    topic: parsed.data.topic,
    booking_id: parsed.data.bookingId || null,
    message: parsed.data.message,
  });
  if (error) return { ok: false, message: "Couldn't send that — please try again." };

  return {
    ok: true,
    message: "Got it — support reviews requests within one business day (booking-blocking issues sooner).",
  };
}

function isPlatformAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function resolveSupportRequest(formData: FormData): Promise<void> {
  const id = String(formData.get("request_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!z.string().uuid().safeParse(id).success) return;
  if (!hasSupabaseEnv()) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) return;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  await admin
    .from("market_support_requests")
    .update({
      status: "resolved",
      resolution_note: note || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open");
  revalidatePath("/dashboard/market-admin");
}

// ── Marketplace sign-in (dedicated page; renters never see the
//    operator-branded /login) ─────────────────────────────────────────

export type MarketSignInState = { ok: boolean; message: string; email?: string };

const signInSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
  redirectTo: z.string().optional().or(z.literal("")),
});

function safeRedirect(target: string | undefined): string {
  // Same-origin paths only; default to the renter home base.
  if (target && target.startsWith("/") && !target.startsWith("//")) return target;
  return "/market/rentals";
}

export async function marketSignIn(
  _prev: MarketSignInState,
  formData: FormData,
): Promise<MarketSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!hasSupabaseEnv()) return { ok: false, message: "Sign-in is unavailable right now.", email };

  const parsed = signInSchema.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
    redirectTo: formData.get("redirect_to") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input.", email };
  }

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:signin",
      actor: key,
      limit: 10,
      windowSeconds: 900,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many attempts — wait a few minutes.", email };
  } catch {
    return { ok: false, message: "Try again shortly.", email };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, message: "Wrong email or password.", email };
  }

  redirect(safeRedirect(parsed.data.redirectTo));
}

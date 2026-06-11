"use server";

import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Renter signup (build plan accounts model): a Supabase auth user with
 * NO organization membership, tagged korent_role='renter' in user
 * metadata so the middleware routes them to the marketplace instead of
 * operator onboarding. Becoming a seller later just means completing
 * onboarding — the tag only changes default routing, never permissions
 * (RLS/membership stay the source of truth).
 */

export type RenterSignupState = { ok: boolean; message: string; email?: string };

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  fullName: z.string().min(1, "Your name is required.").max(100),
  termsAccepted: z.literal("on", { errorMap: () => ({ message: "Please accept the terms." }) }),
});

export async function renterSignUp(
  _prev: RenterSignupState,
  formData: FormData,
): Promise<RenterSignupState> {
  const email = String(formData.get("email") ?? "");
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Signup is unavailable in this environment.", email };
  }

  const parsed = schema.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("full_name") ?? "").trim(),
    termsAccepted: String(formData.get("terms_accepted") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input.", email };
  }

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:renter-signup",
      actor: key,
      limit: 5,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) {
      return { ok: false, message: "Too many attempts — try again later.", email };
    }
  } catch {
    return { ok: false, message: "Try again shortly.", email };
  }

  const siteUrl = await getSiteUrl();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Verified renters land back on the marketplace, not onboarding.
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/market/rentals`,
      data: {
        full_name: parsed.data.fullName,
        korent_role: "renter",
      },
    },
  });

  if (error) return { ok: false, message: error.message, email };
  return {
    ok: true,
    message: "Check your email to verify your account — then you can book anything on the marketplace.",
  };
}

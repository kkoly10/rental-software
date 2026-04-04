"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getSiteUrl } from "@/lib/site-url";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type AuthActionState = {
  ok: boolean;
  message: string;
};

function getValidationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Please review the form and try again.";
}

function safeRedirectPath(value?: string) {
  if (!value) return "/dashboard";
  return value.startsWith("/") ? value : "/dashboard";
}

async function checkAuthRateLimit(options: {
  scope: "signin" | "signup" | "password-reset";
  email: string;
}) {
  const clientKey = await getActionClientKey();

  const limits = {
    signin: {
      client: { limit: 10, windowSeconds: 900 },
      email: { limit: 8, windowSeconds: 900 },
      message: "Too many sign-in attempts. Please wait a few minutes and try again.",
    },
    signup: {
      client: { limit: 5, windowSeconds: 3600 },
      email: { limit: 3, windowSeconds: 3600 },
      message: "Too many signup attempts. Please wait before trying again.",
    },
    "password-reset": {
      client: { limit: 5, windowSeconds: 3600 },
      email: { limit: 3, windowSeconds: 3600 },
      message: "Too many password reset attempts. Please wait before trying again.",
    },
  }[options.scope];

  const [clientLimit, emailLimit] = await Promise.all([
    enforceRateLimit({
      scope: `auth:${options.scope}:client`,
      actor: clientKey,
      limit: limits.client.limit,
      windowSeconds: limits.client.windowSeconds,
    }),
    enforceRateLimit({
      scope: `auth:${options.scope}:email`,
      actor: options.email,
      limit: limits.email.limit,
      windowSeconds: limits.email.windowSeconds,
    }),
  ]);

  if (!clientLimit.allowed || !emailLimit.allowed) {
    return {
      ok: false,
      message: limits.message,
    } satisfies AuthActionState;
  }

  return null;
}

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message:
        "Supabase environment variables are missing. Add them to .env.local to enable auth.",
    };
  }

  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirect: String(formData.get("redirect") ?? "/dashboard"),
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  try {
    const rateLimitFailure = await checkAuthRateLimit({
      scope: "signin",
      email: parsed.data.email,
    });

    if (rateLimitFailure) {
      await logAppEvent({
        source: "auth.signin",
        action: "rate_limited",
        status: "warning",
        metadata: { email: parsed.data.email },
      });

      return rateLimitFailure;
    }
  } catch (error) {
    await logAppError({
      source: "auth.signin",
      message: "Sign-in rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      context: { email: parsed.data.email },
    });

    return {
      ok: false,
      message: "Unable to process sign-in right now. Please try again shortly.",
    };
  }

  const { email, password, redirect: requestedRedirect } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await logAppEvent({
      source: "auth.signin",
      action: "failed",
      status: "warning",
      metadata: { email, reason: error.message },
    });

    return { ok: false, message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await logAppError({
      source: "auth.signin",
      message: "User missing after successful sign-in attempt",
      context: { email },
    });

    return {
      ok: false,
      message: "Unable to load your account after sign-in. Please try again.",
    };
  }

  if (!user.email_confirmed_at) {
    await supabase.auth.signOut();

    await logAppEvent({
      userId: user.id,
      source: "auth.signin",
      action: "blocked_unverified",
      status: "warning",
      metadata: { email },
    });

    return {
      ok: false,
      message: "Please verify your email before signing in.",
    };
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("id, organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  await logAppEvent({
    organizationId: membership?.organization_id ?? null,
    userId: user.id,
    source: "auth.signin",
    action: "success",
    status: "success",
  });

  if (!membership) {
    redirect("/onboarding");
  }

  redirect(safeRedirectPath(requestedRedirect));
}

export async function signUpWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message:
        "Supabase environment variables are missing. Add them to .env.local to enable auth.",
    };
  }

  const parsed = signUpSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    termsAccepted: String(formData.get("terms_accepted") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  try {
    const rateLimitFailure = await checkAuthRateLimit({
      scope: "signup",
      email: parsed.data.email,
    });

    if (rateLimitFailure) {
      await logAppEvent({
        source: "auth.signup",
        action: "rate_limited",
        status: "warning",
        metadata: { email: parsed.data.email },
      });

      return rateLimitFailure;
    }
  } catch (error) {
    await logAppError({
      source: "auth.signup",
      message: "Signup rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      context: { email: parsed.data.email },
    });

    return {
      ok: false,
      message: "Unable to process signup right now. Please try again shortly.",
    };
  }

  const { email, password, fullName, phone } = parsed.data;
  const siteUrl = await getSiteUrl();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding`,
      data: {
        full_name: fullName ?? null,
        phone: phone ?? null,
      },
    },
  });

  if (error) {
    await logAppEvent({
      source: "auth.signup",
      action: "failed",
      status: "warning",
      metadata: { email, reason: error.message },
    });

    return { ok: false, message: error.message };
  }

  await logAppEvent({
    source: "auth.signup",
    action: "created",
    status: "success",
    metadata: { email },
  });

  // Record terms acceptance on the profile (non-blocking — don't block signup if this fails)
  const hdrs = await headers();
  const clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    import("@/lib/supabase/admin").then(async ({ createSupabaseAdminClient }) => {
      const admin = createSupabaseAdminClient();
      await admin
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: "2026-03-30",
          terms_ip: clientIp,
        })
        .eq("id", user.id);
    }).catch((err) => logAppError({ source: "auth/terms-acceptance", message: "Failed to record terms acceptance", context: { error: String(err) } }));
  }

  await supabase.auth.signOut();
  redirect("/auth/verify-email");
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message:
        "Supabase environment variables are missing. Add them to .env.local to enable auth.",
    };
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  try {
    const rateLimitFailure = await checkAuthRateLimit({
      scope: "password-reset",
      email: parsed.data.email,
    });

    if (rateLimitFailure) {
      await logAppEvent({
        source: "auth.password_reset",
        action: "rate_limited",
        status: "warning",
        metadata: { email: parsed.data.email },
      });

      return rateLimitFailure;
    }
  } catch (error) {
    await logAppError({
      source: "auth.password_reset",
      message: "Password reset rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      context: { email: parsed.data.email },
    });

    return {
      ok: false,
      message:
        "Unable to process password reset right now. Please try again shortly.",
    };
  }

  const siteUrl = await getSiteUrl();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    await logAppEvent({
      source: "auth.password_reset",
      action: "failed",
      status: "warning",
      metadata: { email: parsed.data.email, reason: error.message },
    });

    return { ok: false, message: error.message };
  }

  await logAppEvent({
    source: "auth.password_reset",
    action: "requested",
    status: "success",
    metadata: { email: parsed.data.email },
  });

  return {
    ok: true,
    message:
      "If an account exists for that email, we sent a password reset link.",
  };
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message:
        "Supabase environment variables are missing. Add them to .env.local to enable auth.",
    };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message:
        "Open the reset page from your email recovery link to update your password.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    await logAppEvent({
      userId: user.id,
      source: "auth.password_reset",
      action: "failed_complete",
      status: "warning",
      metadata: { reason: error.message },
    });

    return { ok: false, message: error.message };
  }

  await logAppEvent({
    userId: user.id,
    source: "auth.password_reset",
    action: "completed",
    status: "success",
  });

  await supabase.auth.signOut();
  redirect("/login?reset=success");
}

export async function signOut(): Promise<void> {
  if (!hasSupabaseEnv()) return;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
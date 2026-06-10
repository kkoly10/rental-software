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
  // Set when sign-in is blocked because the email is unverified. The login
  // form reads this and surfaces a "Resend verification email" affordance
  // instead of leaving the user stuck with no self-serve recovery.
  needsVerification?: boolean;
  /** Echo back the email the user submitted so the resend-button can call
      the resend action without making the user re-type it. Also reused by
      the login + signup forms to keep the email field pre-populated after
      a failed submit (React 19's form-action reset would otherwise wipe
      the value and force the user to retype). */
  email?: string;
  /** Signup-side fields preserved on error returns from
      signUpWithPassword so the form stays populated on a failed
      submission. Password is intentionally NOT echoed (security); terms
      acceptance is NOT echoed (force a fresh acknowledgment on retry). */
  fullName?: string;
  phone?: string;
};

function getValidationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Please review the form and try again.";
}

function safeRedirectPath(value?: string) {
  if (!value) return "/dashboard";
  // Must be a same-site absolute path. Reject protocol-relative ("//host") and
  // backslash tricks ("/\\host") that browsers normalize to an off-site URL.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/dashboard";
  }
  return value;
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
  // Capture the email up front so every error path can echo it back
  // and the login form preserves it. Otherwise a wrong-password error
  // clears the email field and the user has to retype before trying
  // again — UX dig pass 5 caught this on the live login page.
  const submittedEmail = String(formData.get("email") ?? "");

  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message:
        "Supabase environment variables are missing. Add them to .env.local to enable auth.",
      email: submittedEmail,
    };
  }

  const parsed = signInSchema.safeParse({
    email: submittedEmail,
    password: String(formData.get("password") ?? ""),
    redirect: String(formData.get("redirect") ?? "/dashboard"),
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error), email: submittedEmail };
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
      });

      return { ...rateLimitFailure, email: submittedEmail };
    }
  } catch (error) {
    await logAppError({
      source: "auth.signin",
      message: "Sign-in rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return {
      ok: false,
      message: "Unable to process sign-in right now. Please try again shortly.",
      email: submittedEmail,
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
      metadata: { reason: error.message },
    });

    return { ok: false, message: error.message, email: submittedEmail };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await logAppError({
      source: "auth.signin",
      message: "User missing after successful sign-in attempt",
    });

    return {
      ok: false,
      message: "Unable to load your account after sign-in. Please try again.",
      email: submittedEmail,
    };
  }

  if (!user.email_confirmed_at) {
    await supabase.auth.signOut();

    await logAppEvent({
      userId: user.id,
      source: "auth.signin",
      action: "blocked_unverified",
      status: "warning",
    });

    return {
      ok: false,
      message: "Please verify your email before signing in.",
      needsVerification: true,
      email: user.email ?? undefined,
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

  // PR-3a — record-on-next-login terms backfill. Three real accounts
  // pre-date the signup terms-write fix and carry terms_accepted_at
  // = NULL. Stamping a fabricated date would lie to the audit; the
  // honest path is to record acceptance the next time they actually
  // sign in (which is now — they re-authenticated with the current
  // terms version live on the site). The WHERE clause makes this a
  // no-op for everyone else: once stamped, the column stays stamped.
  try {
    const hdrs = await headers();
    const { getTrustedClientIp } = await import("@/lib/security/request-client");
    const trustedIp = getTrustedClientIp(hdrs);
    const clientIp = trustedIp === "unknown" ? null : trustedIp;
    // PR-3e review fix — use the admin client (mirrors the signup
    // action at line ~388 which writes the same columns the same
    // way). The session-bound supabase client at the top of this
    // function was created BEFORE signInWithPassword established the
    // session cookies; an RLS-gated UPDATE through it can silently
    // fail when the new session hasn't propagated, and the
    // catch-and-log below would swallow the failure — leaving the
    // backfill unfired for the very 3 real accounts it exists to
    // serve. Admin client bypasses RLS for this single write.
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    // Same version constant the signup action stamps — keeping them
    // in sync until a versioned-terms registry lands as its own change.
    await admin
      .from("profiles")
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: "2026-03-30",
        terms_ip: clientIp,
      })
      .eq("id", user.id)
      .is("terms_accepted_at", null);
  } catch (err) {
    await logAppError({
      userId: user.id,
      source: "auth.signin.terms_backfill",
      message: "Terms record-on-login backfill failed",
      context: { reason: err instanceof Error ? err.message : String(err) },
    });
  }

  if (!membership) {
    redirect("/onboarding");
  }

  redirect(safeRedirectPath(requestedRedirect));
}

export async function signUpWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Capture the text-input values up front so every error return can
  // echo them back. Same React 19 form-reset pattern that bit the
  // login + checkout + new-order forms — without this echo, a single
  // validation failure wipes name/phone/email and the user starts over.
  const submittedEmail = String(formData.get("email") ?? "");
  const submittedFullName = String(formData.get("full_name") ?? "");
  const submittedPhone = String(formData.get("phone") ?? "");
  const stickyEcho = {
    email: submittedEmail,
    fullName: submittedFullName,
    phone: submittedPhone,
  };

  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message:
        "Supabase environment variables are missing. Add them to .env.local to enable auth.",
      ...stickyEcho,
    };
  }

  const parsed = signUpSchema.safeParse({
    email: submittedEmail,
    password: String(formData.get("password") ?? ""),
    fullName: submittedFullName,
    phone: submittedPhone,
    termsAccepted: String(formData.get("terms_accepted") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error), ...stickyEcho };
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
      });

      return { ...rateLimitFailure, ...stickyEcho };
    }
  } catch (error) {
    await logAppError({
      source: "auth.signup",
      message: "Signup rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return {
      ok: false,
      message: "Unable to process signup right now. Please try again shortly.",
      ...stickyEcho,
    };
  }

  const { email, password, fullName, phone } = parsed.data;
  const siteUrl = await getSiteUrl();
  const supabase = await createSupabaseServerClient();

  const { data: signUpData, error } = await supabase.auth.signUp({
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
      metadata: { reason: error.message },
    });

    return { ok: false, message: error.message, ...stickyEcho };
  }

  await logAppEvent({
    source: "auth.signup",
    action: "created",
    status: "success",
  });

  // Record terms acceptance on the profile before terminating the Lambda
  // via redirect.
  //
  // Compliance review (gap #24) found ZERO of the production profiles
  // carried this audit data despite 6 of 7 signing up after the feature
  // shipped. Root cause: the old code called `supabase.auth.getUser()`
  // here — but with email confirmation required, signUp creates NO
  // session, so getUser() returned null and the `if (user)` block
  // silently never ran. The user id is available on the signUp response
  // itself (returned even before the email is confirmed), so use that.
  const hdrs = await headers();
  const { getTrustedClientIp } = await import("@/lib/security/request-client");
  const trustedIp = getTrustedClientIp(hdrs);
  const clientIp = trustedIp === "unknown" ? null : trustedIp;
  const newUserId = signUpData?.user?.id ?? null;
  if (newUserId) {
    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      const { error: termsError } = await admin
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: "2026-03-30",
          terms_ip: clientIp,
        })
        .eq("id", newUserId);
      if (termsError) {
        // Don't fail the signup — but a silent miss here is exactly the
        // bug this comment documents, so it must land in observability.
        await logAppError({
          source: "auth/terms-acceptance",
          message: "Failed to record terms acceptance",
          context: { db_error: termsError.message, user_id: newUserId },
        });
      }
    } catch (err) {
      await logAppError({ source: "auth/terms-acceptance", message: "Failed to record terms acceptance", context: { error: String(err) }, error: err });
    }
  } else {
    // signUp returned no user object at all (e.g. obfuscated duplicate-
    // email response). Log it — an empty audit trail must never be silent.
    await logAppError({
      source: "auth/terms-acceptance",
      message: "signUp returned no user — terms acceptance not recorded",
      context: { email_domain: email.split("@")[1] ?? "unknown" },
    });
  }

  await supabase.auth.signOut();
  redirect("/auth/verify-email");
}

/**
 * Re-send the email-confirmation link for an account that signed up but
 * never clicked through. Without this, a user who lost the original email
 * has no self-serve path back into the product — they have to make a new
 * account or contact support.
 */
export async function resendVerificationEmail(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { ok: false, message: "Enter the email you signed up with." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "Demo mode: verification email would be resent.",
    };
  }

  try {
    const limits = await enforceRateLimit({
      scope: "auth:resend-verification:email",
      actor: email,
      limit: 3,
      windowSeconds: 600,
      strict: true,
    });
    if (!limits.allowed) {
      return {
        ok: false,
        message: "Too many requests. Wait a few minutes and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to send the verification email right now. Please try again shortly.",
    };
  }

  const siteUrl = await getSiteUrl();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding`,
    },
  });

  if (error) {
    // Don't leak which emails are registered. A 'User not found' from
    // Supabase still returns ok=true to the caller (mirrors the password
    // reset action's behaviour).
    await logAppEvent({
      source: "auth.resend-verification",
      action: "supabase_resend_returned_error",
      status: "warning",
      metadata: { message: error.message },
    });
  }

  return {
    ok: true,
    message:
      "If your account exists and is unverified, we just sent a fresh link. Check your email.",
  };
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
      });

      return rateLimitFailure;
    }
  } catch (error) {
    await logAppError({
      source: "auth.password_reset",
      message: "Password reset rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      error,
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
      metadata: { reason: error.message },
    });

    return { ok: false, message: error.message };
  }

  await logAppEvent({
    source: "auth.password_reset",
    action: "requested",
    status: "success",
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

  // Explicitly invalidate ALL of this user's sessions, not just the
  // one held by the current request. After a password reset we want
  // any concurrent attacker session (e.g. from a phishing-stolen
  // token that prompted the reset in the first place) to lose access
  // immediately. `scope: 'global'` triggers Supabase to revoke every
  // active refresh token for this user.
  await supabase.auth.signOut({ scope: "global" });
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
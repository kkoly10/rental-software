"use server";

import { redirect } from "next/navigation";
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

  const { email, password, redirect: requestedRedirect } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "Unable to load your account after sign-in. Please try again.",
    };
  }

  if (!user.email_confirmed_at) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Please verify your email before signing in.",
    };
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

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
  });

  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
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
    return { ok: false, message: error.message };
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

  const siteUrl = await getSiteUrl();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

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
    return { ok: false, message: error.message };
  }

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
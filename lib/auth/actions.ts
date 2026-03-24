"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

export type AuthActionState = {
  ok: boolean;
  message: string;
};

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "Supabase environment variables are missing.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    return {
      ok: false,
      message: "Email and password are required.",
    };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    message: "Signed in successfully.",
  };
}

export async function signUpWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "Supabase environment variables are missing.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!email || !password) {
    return {
      ok: false,
      message: "Email and password are required.",
    };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    message: "Account created. Check your email for confirmation if enabled.",
  };
}
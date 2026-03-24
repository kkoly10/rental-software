"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

export async function signInWithPassword(formData: FormData) {
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

export async function signUpWithPassword(formData: FormData) {
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
  const { error } = await supabase.auth.signUp({ email, password });

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

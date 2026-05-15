"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./config";

export async function setLocale(formData: FormData) {
  const value = formData.get("locale");
  if (typeof value !== "string" || !isLocale(value)) {
    return { ok: false };
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true };
}

"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { normalizePhoneE164, sendSms } from "@/lib/sms/provider";
import { sniffImageType } from "@/lib/utils/image-signature";

/**
 * Renter trust v2 (founder decision 2026-06-11, Turo-style DIY):
 *  - phone verification via SMS OTP (hashed code, 10-min TTL, 5 tries)
 *  - ID photo + live selfie captured to the PRIVATE market-identity
 *    bucket; no automated check, no third-party service — admins view
 *    via signed URLs only when a dispute requires it.
 */

export type VerifyState = { ok: boolean; message: string };

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const IDENTITY_BUCKET = "market-identity";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 15 * 1024 * 1024;

function hashCode(code: string): string {
  return createHash("sha256").update(`market-otp:${code}`).digest("hex");
}

async function rateLimited(scope: string, limit: number): Promise<boolean> {
  try {
    const key = await getActionClientKey();
    const r = await enforceRateLimit({ scope, actor: key, limit, windowSeconds: 3600, strict: true });
    return !r.allowed;
  } catch {
    return true;
  }
}

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function sendPhoneOtp(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Unavailable in this environment." };
  const user = await getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const phone = normalizePhoneE164(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "Enter a valid US phone number." };
  if (await rateLimited("market:otp-send", 5)) {
    return { ok: false, message: "Too many codes requested — try again later." };
  }

  const code = String(randomInt(100000, 1000000));
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  await admin.from("market_phone_otp").upsert(
    {
      profile_id: user.id,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
    },
    { onConflict: "profile_id" },
  );
  // Stash the unverified phone so confirmPhoneOtp knows what to verify.
  await admin.from("market_renter_verifications").upsert(
    { profile_id: user.id, phone, updated_at: new Date().toISOString() },
    { onConflict: "profile_id" },
  );

  const result = await sendSms({
    to: phone,
    body: `Your Korent Marketplace verification code is ${code}. It expires in 10 minutes.`,
  });
  if (!result.ok) {
    return { ok: false, message: "Couldn't send the text — check the number and try again." };
  }
  return { ok: true, message: `Code sent to ${phone}.` };
}

export async function confirmPhoneOtp(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Unavailable in this environment." };
  const user = await getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, message: "Enter the 6-digit code." };

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { data: otp } = await admin
    .from("market_phone_otp")
    .select("code_hash, expires_at, attempts")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!otp) return { ok: false, message: "Request a code first." };
  if (new Date(otp.expires_at) < new Date()) {
    return { ok: false, message: "That code expired — request a new one." };
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, message: "Too many attempts — request a new code." };
  }

  await admin
    .from("market_phone_otp")
    .update({ attempts: otp.attempts + 1 })
    .eq("profile_id", user.id);

  const expected = Buffer.from(otp.code_hash, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, message: "Wrong code — try again." };
  }

  await admin
    .from("market_renter_verifications")
    .update({ phone_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("profile_id", user.id);
  await admin.from("market_phone_otp").delete().eq("profile_id", user.id);

  revalidatePath("/market/verify");
  return { ok: true, message: "Phone verified." };
}

const idSchema = z.object({});

export async function uploadIdentity(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Unavailable in this environment." };
  const user = await getUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (await rateLimited("market:id-upload", 6)) {
    return { ok: false, message: "Too many uploads — try again later." };
  }
  void idSchema;

  const idPhoto = formData.get("id_photo");
  const selfie = formData.get("selfie");
  if (!(idPhoto instanceof File) || idPhoto.size === 0 || !(selfie instanceof File) || selfie.size === 0) {
    return { ok: false, message: "Both photos are required — your ID and a live selfie." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const paths: Record<string, string> = {};

  for (const [field, file] of [
    ["id_photo_path", idPhoto],
    ["selfie_path", selfie],
  ] as const) {
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE) {
      return { ok: false, message: "Photos must be JPEG/PNG/WebP under 15 MB." };
    }
    const sniffed = await sniffImageType(file);
    if (!sniffed || !ALLOWED_TYPES.includes(sniffed)) {
      return { ok: false, message: "File content doesn't match a supported image format." };
    }
    const ext = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${field === "id_photo_path" ? "id" : "selfie"}-${Date.now()}.${ext}`;
    const { error } = await admin.storage
      .from(IDENTITY_BUCKET)
      .upload(path, file, { contentType: sniffed, upsert: false });
    if (error) return { ok: false, message: "Upload failed — please try again." };
    paths[field] = path;
  }

  const { error } = await admin.from("market_renter_verifications").upsert(
    {
      profile_id: user.id,
      id_photo_path: paths.id_photo_path,
      selfie_path: paths.selfie_path,
      id_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return { ok: false, message: "Couldn't save — try again." };

  revalidatePath("/market/verify");
  return {
    ok: true,
    message: "Identity on file. It's stored privately and only reviewed if a dispute arises.",
  };
}

/** Booking-gate helper: what the renter still needs for a category. */
export async function getVerificationStatus(profileId: string): Promise<{
  phoneVerified: boolean;
  idOnFile: boolean;
}> {
  if (!hasSupabaseEnv()) return { phoneVerified: false, idOnFile: false };
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("market_renter_verifications")
    .select("phone_verified_at, id_uploaded_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  return {
    phoneVerified: Boolean(data?.phone_verified_at),
    idOnFile: Boolean(data?.id_uploaded_at),
  };
}

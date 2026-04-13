"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SettingsActionState } from "./actions";

/* ── Zod schemas ── */

const faqSchema = z.array(
  z.object({
    question: z.string().min(1, "Question is required"),
    answer: z.string().min(1, "Answer is required"),
  })
);

const testimonialSchema = z.array(
  z.object({
    name: z.string().min(1, "Name is required"),
    text: z.string().min(1, "Review text is required"),
    rating: z.number().int().min(1).max(5),
  })
);

const trustBadgeSchema = z
  .array(
    z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().min(1, "Description is required"),
    })
  )
  .max(4, "Maximum 4 trust badges allowed");

const navLinkSchema = z.array(
  z.object({
    key: z.string().min(1),
    label: z.string().min(1, "Label is required").max(30, "Label must be 30 characters or fewer"),
    href: z.string().min(1),
    visible: z.boolean(),
  })
);

const sectionVisibilitySchema = z.record(z.string(), z.boolean());

/* ── Helpers ── */

async function readMergeWrite(
  key: string,
  value: unknown
): Promise<SettingsActionState> {
  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const existingSettings = (org?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...existingSettings,
        [key]: value,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/website");
  revalidatePath("/");
  return { ok: true, message: "Saved successfully." };
}

/* ── Actions ── */

export async function updateFaqContent(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = String(formData.get("faq_json") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid FAQ data." };
  }

  const result = faqSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid FAQ data." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: FAQs would be updated." };
  }

  return readMergeWrite("custom_faq", result.data);
}

export async function updateAboutContent(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const aboutText = String(formData.get("about_text") ?? "").trim();

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: About section would be updated." };
  }

  return readMergeWrite("about_text", aboutText);
}

export async function updateTestimonials(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = String(formData.get("testimonials_json") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid testimonials data." };
  }

  const result = testimonialSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid testimonials data." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Testimonials would be updated." };
  }

  return readMergeWrite("testimonials", result.data);
}

export async function updateTrustBadges(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = String(formData.get("trust_badges_json") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid trust badges data." };
  }

  const result = trustBadgeSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid trust badges data." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Trust badges would be updated." };
  }

  return readMergeWrite("trust_badges", result.data);
}

export async function updateSectionVisibility(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = String(formData.get("visibility_json") ?? "{}");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid visibility data." };
  }

  const result = sectionVisibilitySchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid visibility data." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Section visibility would be updated." };
  }

  return readMergeWrite("section_visibility", result.data);
}

export async function updateNavLinks(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = String(formData.get("nav_links_json") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid navigation data." };
  }

  const result = navLinkSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid navigation data." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Navigation would be updated." };
  }

  return readMergeWrite("nav_links", result.data);
}

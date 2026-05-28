"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SettingsActionState } from "./actions";
import { isSafeHref } from "@/lib/utils/safe-href";
import { mergeOrgSettings } from "./merge-settings";

const MAX_JSON_BYTES = 50_000;

function parseJsonField(raw: string, label: string): { ok: true; value: unknown } | { ok: false; message: string } {
  if (raw.length > MAX_JSON_BYTES) {
    return { ok: false, message: `${label} payload too large (max 50 KB).` };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, message: `Invalid ${label} data.` };
  }
}

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
    href: z
      .string()
      .min(1)
      .refine(isSafeHref, "Link must be a relative path or an http(s) URL."),
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

  const { data: contentMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(contentMembership?.role ?? "")) {
    return { ok: false, message: "Only owners and admins can update website content." };
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, { [key]: value });
  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  revalidatePath("/dashboard/website");
  // #377 nav links, FAQ, testimonials, badges render via PublicHeader/Footer
  // on every storefront subpage — revalidate at layout level so subpages
  // don't keep the old content until ISR.
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved successfully." };
}

/* ── Actions ── */

export async function updateFaqContent(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = String(formData.get("faq_json") ?? "[]");
  const decoded = parseJsonField(raw, "FAQ");
  if (!decoded.ok) return { ok: false, message: decoded.message };

  const result = faqSchema.safeParse(decoded.value);
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
  const aboutText = String(formData.get("about_text") ?? "").trim().slice(0, 10000);

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
  const decoded = parseJsonField(raw, "Testimonials");
  if (!decoded.ok) return { ok: false, message: decoded.message };

  const result = testimonialSchema.safeParse(decoded.value);
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
  const decoded = parseJsonField(raw, "Trust badges");
  if (!decoded.ok) return { ok: false, message: decoded.message };

  const result = trustBadgeSchema.safeParse(decoded.value);
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
  const decoded = parseJsonField(raw, "Visibility");
  if (!decoded.ok) return { ok: false, message: decoded.message };

  const result = sectionVisibilitySchema.safeParse(decoded.value);
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
  const decoded = parseJsonField(raw, "Navigation");
  if (!decoded.ok) return { ok: false, message: decoded.message };

  const result = navLinkSchema.safeParse(decoded.value);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid navigation data." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Navigation would be updated." };
  }

  return readMergeWrite("nav_links", result.data);
}

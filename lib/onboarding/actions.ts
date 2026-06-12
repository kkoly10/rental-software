"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generateSlug, isSlugAvailable, isValidSlugFormat, getAppDomain } from "@/lib/auth/resolve-org";
import { escapeHtml } from "@/lib/maps/escape-html";
import {
  renderEmailLayout,
  emailHeading,
  emailLead,
  emailCallout,
  emailButton,
} from "@/lib/email/templates";

export type OnboardingActionState = {
  ok: boolean;
  message: string;
  storefrontUrl?: string;
};

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const businessName = String(formData.get("business_name") ?? "").trim().slice(0, 255);
  const timezone = String(formData.get("timezone") ?? "America/New_York").trim().slice(0, 100);
  const zipCode = String(formData.get("zip_code") ?? "").trim().slice(0, 20);
  const deliveryFee = parseFloat(String(formData.get("delivery_fee") ?? "25"));
  const minimumOrder = parseFloat(String(formData.get("minimum_order") ?? "100"));
  // Phase 3/2d — multi-vertical signup picker. The form now offers
  // the 6 registry verticals (inflatable + the wedding/banquet triad
  // + photo-booths + concessions); car/equipment stay accepted for
  // any half-completed legacy session that posts an old value. The
  // bootstrap RPC's per-vertical category seed branches keep these
  // values in lockstep (migration 20260608_170000).
  const businessType = [
    "inflatable",
    "tents",
    "tables-and-chairs",
    "dance-floors",
    "photo-booths",
    "concessions",
    "car",
    "equipment",
  ].includes(String(formData.get("business_type") ?? ""))
    ? String(formData.get("business_type"))
    : "inflatable";
  let slugInput = String(formData.get("slug") ?? "").trim();

  if (!businessName) {
    return { ok: false, message: "Business name is required." };
  }

  // Generate slug if not provided
  if (!slugInput) {
    slugInput = generateSlug(businessName);
  }

  if (!isValidSlugFormat(slugInput)) {
    return {
      ok: false,
      message: "URL slug must be 3-63 lowercase letters, numbers, and hyphens.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: "${businessName}" would be created.`,
      storefrontUrl: `https://${slugInput}.${getAppDomain()}`,
    };
  }

  const available = await isSlugAvailable(slugInput);
  if (!available) {
    return {
      ok: false,
      message: "That URL slug is already taken or reserved. Please choose a different one.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "You must be signed in to create an organization.",
    };
  }

  // Keep this fast redirect for already-onboarded users
  const { data: existingMembership } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingMembership) {
    redirect("/dashboard");
  }

  const { data, error } = await supabase.rpc("bootstrap_organization", {
    p_business_name: businessName,
    p_slug: slugInput,
    p_timezone: timezone,
    p_zip_code: zipCode || null,
    p_delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 25,
    p_minimum_order: Number.isFinite(minimumOrder) ? minimumOrder : 100,
    p_business_type: businessType,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "That storefront URL is already taken. Please choose a different one.",
      };
    }

    return {
      ok: false,
      message: error.message || "Failed to complete onboarding.",
    };
  }

  if (!data) {
    return {
      ok: false,
      message: "Organization creation returned no result.",
    };
  }

  const orgId = data as string;
  if (orgId) {
    // Record onboarding completion timestamp in org settings
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    const existingSettings = (org?.settings as Record<string, unknown>) ?? {};
    const { error: tsError } = await supabase
      .from("organizations")
      .update({
        settings: {
          ...existingSettings,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .eq("id", orgId)
      .is("deleted_at", null);

    if (tsError) {
      console.error("[onboarding] Failed to record onboarding_completed_at:", tsError.message);
    }

    const storefrontUrl = `https://${slugInput}.${getAppDomain()}`;
    const dashboardUrl = `https://${getAppDomain()}/dashboard`;
    try {
      const { sendEmail } = await import("@/lib/email/send");
      await sendEmail({
        to: user.email ?? "",
        subject: "Welcome to Korent — your rental site is live!",
        html: welcomeEmailHtml(businessName, storefrontUrl, dashboardUrl),
        replyTo: "support@korent.app",
        organizationId: orgId,
      });
    } catch (err) {
      // #406 surface the actual reason in Sentry / app_error_logs so the
      // operator can see when welcome emails stop sending.
      console.error("[onboarding] welcome email failed:", err instanceof Error ? err.message : err);
      try {
        const { logAppError } = await import("@/lib/observability/server");
        await logAppError({
          organizationId: orgId,
          source: "onboarding.welcome_email",
          message: "Failed to send welcome email after onboarding",
          context: { reason: err instanceof Error ? err.message : String(err) },
          error: err,
        });
      } catch { /* don't let the logger break onboarding */ }
    }
  }

  return {
    ok: true,
    message: "Your business is set up!",
    storefrontUrl: `https://${slugInput}.${getAppDomain()}`,
  };
}

function welcomeEmailHtml(businessName: string, storefrontUrl: string, dashboardUrl: string): string {
  const safeStore = escapeHtml(storefrontUrl);
  const safeDash = escapeHtml(dashboardUrl);
  // Korent's own onboarding mail — letterhead reads "Korent" with the
  // Korent burnt-orange accent (the operator's storefront isn't theirs to
  // brand yet; this is the platform welcoming them).
  const KORENT_ACCENT = "#c2410c";
  const checklist = [
    ["Add your first product", "Create a rental listing with pricing and photos"],
    ["Customize your website", "Upload your logo, set brand colors, and add a hero message"],
    ["Set up payment collection", "Connect Stripe to accept online deposits"],
  ]
    .map(
      ([title, body], i) => `
      <tr>
        <td style="padding:14px 0;border-top:${i === 0 ? "0" : "1px solid #e4ded3"};vertical-align:top;width:34px;font-family:Georgia,'Times New Roman',Times,serif;font-size:18px;font-style:italic;color:${KORENT_ACCENT};">${i + 1}</td>
        <td style="padding:14px 0;border-top:${i === 0 ? "0" : "1px solid #e4ded3"};">
          <strong style="font-size:14px;color:#1f1c17;">${escapeHtml(title)}</strong>
          <p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#5c5651;">${escapeHtml(body)}</p>
        </td>
      </tr>`
    )
    .join("");

  return renderEmailLayout(
    "Korent",
    `
    ${emailHeading(`Welcome aboard, ${businessName}!`)}
    ${emailLead("Your rental site is live and ready for customers. Here's how to get started.")}

    ${emailCallout(
      "note",
      "Your storefront URL",
      `<a href="${safeStore}" style="color:#9a3412;font-weight:600;text-decoration:none;">${safeStore}</a>`
    )}

    <p style="margin:28px 0 4px;font-family:Georgia,'Times New Roman',Times,serif;font-size:17px;color:#1f1c17;">Quick start checklist</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 4px;border-top:1px solid #cfc7b7;">
      ${checklist}
    </table>

    ${emailButton("Go to Dashboard", dashboardUrl)}

    <p style="font-size:14px;color:#5c5651;">
      Need help? Visit our <a href="${safeDash}/help" style="color:#9a3412;font-weight:500;">Help Center</a>
      or reply to this email — we're here to help you succeed.
    </p>
    `,
    `<p style="margin:0;">Sent by Korent — rental business software</p>`,
    undefined,
    "en",
    KORENT_ACCENT
  );
}

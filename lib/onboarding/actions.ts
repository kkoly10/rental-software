"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generateSlug, isSlugAvailable, isValidSlugFormat, getAppDomain } from "@/lib/auth/resolve-org";

export type OnboardingActionState = {
  ok: boolean;
  message: string;
  storefrontUrl?: string;
};

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/New_York").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const deliveryFee = parseFloat(String(formData.get("delivery_fee") ?? "25"));
  const minimumOrder = parseFloat(String(formData.get("minimum_order") ?? "100"));
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
    p_timezone: timezone,
    p_zip_code: zipCode || null,
    p_delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 25,
    p_minimum_order: Number.isFinite(minimumOrder) ? minimumOrder : 100,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "An organization with that name already exists.",
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

  // Update the slug to the user's chosen one (the RPC may have generated a different one)
  const orgId = typeof data === "string" ? data : (data as any)?.organization_id ?? data;
  if (orgId) {
    await supabase
      .from("organizations")
      .update({ slug: slugInput })
      .eq("id", orgId);

    // Record onboarding completion timestamp in org settings
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();

    const existingSettings = (org?.settings as Record<string, unknown>) ?? {};
    await supabase
      .from("organizations")
      .update({
        settings: {
          ...existingSettings,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .eq("id", orgId);

    // Send welcome email to the operator (non-blocking)
    const storefrontUrl = `https://${slugInput}.${getAppDomain()}`;
    const dashboardUrl = `https://${getAppDomain()}/dashboard`;
    import("@/lib/email/send").then(({ sendEmail }) =>
      sendEmail({
        to: user.email ?? "",
        subject: "Welcome to Korent — your rental site is live!",
        html: welcomeEmailHtml(businessName, storefrontUrl, dashboardUrl),
        replyTo: "support@korent.app",
        organizationId: orgId,
      })
    ).catch(() => {});
  }

  return {
    ok: true,
    message: "Your business is set up!",
    storefrontUrl: `https://${slugInput}.${getAppDomain()}`,
  };
}

function welcomeEmailHtml(businessName: string, storefrontUrl: string, dashboardUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#10233f;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #dbe6f4;box-shadow:0 4px 12px rgba(16,35,63,0.06);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e5dcf,#2d77f2);padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;">Korent</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#10233f;">Welcome aboard, ${businessName}!</h1>
            <p style="color:#55708f;font-size:15px;">Your rental site is live and ready for customers. Here's how to get started:</p>

            <div style="margin:24px 0;padding:20px;background:#f4f7fb;border-radius:12px;">
              <p style="margin:0 0 12px;font-weight:600;">Your storefront URL:</p>
              <a href="${storefrontUrl}" style="color:#1e5dcf;font-weight:600;font-size:15px;">${storefrontUrl}</a>
            </div>

            <h2 style="font-size:16px;margin:24px 0 12px;">Quick start checklist</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr><td style="padding:8px 0;font-size:14px;color:#10233f;">1. <strong>Add your first product</strong> — Create a rental listing with pricing and photos</td></tr>
              <tr><td style="padding:8px 0;font-size:14px;color:#10233f;">2. <strong>Customize your website</strong> — Upload your logo, set brand colors, and add a hero message</td></tr>
              <tr><td style="padding:8px 0;font-size:14px;color:#10233f;">3. <strong>Set up payment collection</strong> — Connect Stripe to accept online deposits</td></tr>
            </table>

            <div style="margin:24px 0;text-align:center;">
              <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;background:#1e5dcf;color:#ffffff;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;">Go to Dashboard</a>
            </div>

            <p style="color:#55708f;font-size:14px;">
              Need help? Visit our <a href="${dashboardUrl}/help" style="color:#1e5dcf;font-weight:500;">Help Center</a>
              or reply to this email — we're here to help you succeed.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #dbe6f4;color:#55708f;font-size:13px;">
            <p style="margin:0;">Sent by <span style="color:#1e5dcf;font-weight:600;">Korent</span> — rental business software</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

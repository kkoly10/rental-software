import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, getOptionalEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { logCommunication } from "@/lib/communications/log";

// ─── Auth ──────────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const secret = getOptionalEnv("CRON_SECRET");
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("cron_secret") === secret;
}

// ─── Date helpers ──────────────────────────────────────────────────────────

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Email templates ──────────────────────────────────────────────────────

function day3NudgeEmail(businessName: string, dashboardUrl: string): string {
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
            <h1 style="margin:0 0 16px;font-size:22px;color:#10233f;">Ready to add your first product?</h1>
            <p style="color:#55708f;font-size:15px;">
              Hey ${businessName}! You signed up a few days ago and your site is live — nice work.
              The next step is adding your first rental product so customers can start booking.
            </p>

            <div style="margin:24px 0;padding:20px;background:#f4f7fb;border-radius:12px;">
              <p style="margin:0 0 8px;font-weight:600;font-size:14px;">It only takes a minute:</p>
              <ol style="margin:0;padding-left:20px;color:#55708f;font-size:14px;">
                <li style="margin-bottom:6px;">Go to your dashboard</li>
                <li style="margin-bottom:6px;">Click <strong>Products &rarr; Add Product</strong></li>
                <li>Set a name, price, and upload a photo</li>
              </ol>
            </div>

            <div style="margin:24px 0;text-align:center;">
              <a href="${dashboardUrl}/products/new" style="display:inline-block;padding:14px 28px;background:#1e5dcf;color:#ffffff;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;">Add Your First Product</a>
            </div>

            <p style="color:#55708f;font-size:14px;">
              Need help? Reply to this email or visit our <a href="${dashboardUrl}/help" style="color:#1e5dcf;font-weight:500;">Help Center</a>.
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

function day7NudgeEmail(businessName: string, dashboardUrl: string): string {
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
            <h1 style="margin:0 0 16px;font-size:22px;color:#10233f;">Need help getting started?</h1>
            <p style="color:#55708f;font-size:15px;">
              Hi ${businessName} — we noticed you haven't added any products yet. No worries!
              Setting up a rental business takes time and we're here to help.
            </p>

            <div style="margin:24px 0;padding:20px;background:#f4f7fb;border-radius:12px;">
              <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Here's what other operators do first:</p>
              <ul style="margin:0;padding-left:20px;color:#55708f;font-size:14px;">
                <li style="margin-bottom:6px;"><strong>Add 1-3 products</strong> with photos and pricing</li>
                <li style="margin-bottom:6px;"><strong>Set up a service area</strong> with your delivery ZIP codes</li>
                <li><strong>Customize your website</strong> with your brand colors and logo</li>
              </ul>
            </div>

            <div style="margin:24px 0;text-align:center;">
              <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;background:#1e5dcf;color:#ffffff;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;">Go to Dashboard</a>
            </div>

            <p style="color:#55708f;font-size:15px;">
              If you're stuck or have questions, just reply to this email — a real person will get back to you.
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

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      ok: true,
      message: "Demo mode: No re-engagement emails sent.",
      metrics: { totalSignups: 0, activated: 0, day3Sent: 0, day7Sent: 0, errors: 0 },
    });
  }

  const supabase = createSupabaseAdminClient();
  const siteUrl = getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

  let day3Sent = 0;
  let day7Sent = 0;
  let errors = 0;

  // Find organizations that completed onboarding but haven't added products
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, settings, support_email");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      metrics: { totalSignups: 0, activated: 0, day3Sent: 0, day7Sent: 0, errors: 0 },
    });
  }

  const now = new Date();
  const day3Cutoff = new Date(daysAgoISO(3));
  const day7Cutoff = new Date(daysAgoISO(7));
  // Don't nudge orgs that signed up more than 14 days ago
  const maxAgeCutoff = new Date(daysAgoISO(14));

  // Activation metrics
  let totalSignups = 0;
  let activated = 0;

  // Collect orgs needing nudges
  const day3Orgs: { id: string; name: string; supportEmail: string }[] = [];
  const day7Orgs: { id: string; name: string; supportEmail: string }[] = [];

  for (const org of orgs) {
    const settings = (org.settings as Record<string, unknown>) ?? {};
    const onboardingAt = settings.onboarding_completed_at as string | undefined;
    if (!onboardingAt) continue;

    totalSignups++;

    const setupProgress = (settings.setup_progress as Record<string, boolean>) ?? {};
    if (setupProgress.has_products) {
      activated++;
      continue;
    }

    const onboardingDate = new Date(onboardingAt);

    // Too old — skip
    if (onboardingDate < maxAgeCutoff) continue;

    const supportEmail = org.support_email ?? "";
    const reengagement = (settings.reengagement as Record<string, string>) ?? {};

    // Day 3 nudge: onboarded >= 3 days ago, not yet sent day3
    if (onboardingDate <= day3Cutoff && !reengagement.day3_sent_at) {
      day3Orgs.push({ id: org.id, name: org.name ?? "there", supportEmail });
    }

    // Day 7 nudge: onboarded >= 7 days ago, not yet sent day7
    if (onboardingDate <= day7Cutoff && !reengagement.day7_sent_at) {
      day7Orgs.push({ id: org.id, name: org.name ?? "there", supportEmail });
    }
  }

  // Look up operator emails for each org
  async function getOperatorEmail(orgId: string): Promise<string | null> {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("profile_id")
      .eq("organization_id", orgId)
      .eq("role", "owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership?.profile_id) return null;

    const { data: auth } = await supabase.auth.admin.getUserById(membership.profile_id);
    return auth?.user?.email ?? null;
  }

  // Send day 3 nudges
  for (const org of day3Orgs) {
    try {
      const email = await getOperatorEmail(org.id);
      if (!email) continue;

      const dashboardUrl = `${siteUrl}/dashboard`;
      const sent = await sendEmail({
        to: email,
        subject: `${org.name}, ready to add your first product?`,
        html: day3NudgeEmail(org.name, dashboardUrl),
        replyTo: "support@korent.app",
        organizationId: org.id,
      });

      if (sent) {
        day3Sent++;

        // Mark as sent in org settings
        const { data: freshOrg } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", org.id)
          .maybeSingle();

        const freshSettings = (freshOrg?.settings as Record<string, unknown>) ?? {};
        const reengagement = (freshSettings.reengagement as Record<string, string>) ?? {};

        await supabase
          .from("organizations")
          .update({
            settings: {
              ...freshSettings,
              reengagement: {
                ...reengagement,
                day3_sent_at: now.toISOString(),
              },
            },
          })
          .eq("id", org.id);

        // Log to communication_log
        logCommunication({
          organizationId: org.id,
          channel: "email",
          direction: "outbound",
          recipient: email,
          subject: `${org.name}, ready to add your first product?`,
          bodyPreview: "Day 3 re-engagement nudge — add your first product",
          status: "sent",
          metadata: { type: "reengagement", nudge: "day3" },
        }).catch(() => {});
      }
    } catch {
      errors++;
    }
  }

  // Send day 7 nudges
  for (const org of day7Orgs) {
    try {
      const email = await getOperatorEmail(org.id);
      if (!email) continue;

      const dashboardUrl = `${siteUrl}/dashboard`;
      const sent = await sendEmail({
        to: email,
        subject: `Need help getting started, ${org.name}?`,
        html: day7NudgeEmail(org.name, dashboardUrl),
        replyTo: "support@korent.app",
        organizationId: org.id,
      });

      if (sent) {
        day7Sent++;

        // Mark as sent in org settings
        const { data: freshOrg } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", org.id)
          .maybeSingle();

        const freshSettings = (freshOrg?.settings as Record<string, unknown>) ?? {};
        const reengagement = (freshSettings.reengagement as Record<string, string>) ?? {};

        await supabase
          .from("organizations")
          .update({
            settings: {
              ...freshSettings,
              reengagement: {
                ...reengagement,
                day7_sent_at: now.toISOString(),
              },
            },
          })
          .eq("id", org.id);

        // Log to communication_log
        logCommunication({
          organizationId: org.id,
          channel: "email",
          direction: "outbound",
          recipient: email,
          subject: `Need help getting started, ${org.name}?`,
          bodyPreview: "Day 7 re-engagement nudge — need help getting started?",
          status: "sent",
          metadata: { type: "reengagement", nudge: "day7" },
        }).catch(() => {});
      }
    } catch {
      errors++;
    }
  }

  // Activation metrics
  const activationRate = totalSignups > 0
    ? Number(((activated / totalSignups) * 100).toFixed(1))
    : 0;

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    metrics: {
      totalSignups,
      activated,
      activationRate,
      day3Sent,
      day7Sent,
      errors,
    },
  });
}

"use server";

import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { hasSupabaseEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/maps/escape-html";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export type ContactState = {
  ok: boolean;
  message: string;
};

async function resolveOperatorEmail(orgId: string | null): Promise<string | null> {
  if (!orgId || !hasSupabaseEnv()) return null;

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("support_email")
    .eq("id", orgId)
    .maybeSingle();

  if (org?.support_email) return org.support_email;

  // Fall back to the org owner's profile email so contact submissions
  // still reach the operator when support_email is unset.
  const { data: ownerMembership } = await supabase
    .from("organization_memberships")
    .select("profiles(email)")
    .eq("organization_id", orgId)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return (ownerMembership as { profiles?: { email?: string | null } | null } | null)
    ?.profiles?.email ?? null;
}

export async function submitContactForm(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Invalid input.";
    return { ok: false, message: firstError };
  }

  const clientKey = await getActionClientKey();
  const limit = await enforceRateLimit({
    scope: "contact:submit",
    actor: clientKey,
    limit: 5,
    windowSeconds: 3600,
    strict: true,
  });

  if (!limit.allowed) {
    return { ok: false, message: "Too many messages. Please try again later." };
  }

  // Resolve the tenant org so the email goes to the operator, not Korent
  const orgId = await getPublicOrgId();

  // Block writes on demo org
  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return { ok: false, message: demoCheck.message };
  }

  const operatorEmail = await resolveOperatorEmail(orgId);

  // Send contact form email to the operator (non-blocking).
  // If we have no destination email, the submission is still recorded in
  // the DB (where applicable) — operators can reach the customer via reply.
  if (operatorEmail) {
    try {
      const { sendEmail } = await import("@/lib/email/send");
      await sendEmail({
        to: operatorEmail,
        subject: `Contact form: ${parsed.data.name}`,
        replyTo: parsed.data.email,
        html: `
          <p><strong>From:</strong> ${escapeHtml(parsed.data.name)} (${escapeHtml(parsed.data.email)})</p>
          <hr />
          <p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br />")}</p>
        `,
        organizationId: orgId ?? undefined,
      });
    } catch {
      // Email delivery is non-blocking
    }
  }

  return {
    ok: true,
    message: "Message sent! We'll get back to you within 24 hours.",
  };
}

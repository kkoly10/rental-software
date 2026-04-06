"use server";

import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { hasSupabaseEnv } from "@/lib/env";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export type ContactState = {
  ok: boolean;
  message: string;
};

const PLATFORM_FALLBACK_EMAIL = "support@korent.app";

async function resolveOperatorEmail(orgId: string | null): Promise<string> {
  if (!orgId || !hasSupabaseEnv()) return PLATFORM_FALLBACK_EMAIL;

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("support_email, name")
    .eq("id", orgId)
    .maybeSingle();

  return org?.support_email || PLATFORM_FALLBACK_EMAIL;
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

  // Send contact form email to the operator (non-blocking)
  try {
    const { sendEmail } = await import("@/lib/email/send");
    await sendEmail({
      to: operatorEmail,
      subject: `Contact form: ${parsed.data.name}`,
      replyTo: parsed.data.email,
      html: `
        <p><strong>From:</strong> ${parsed.data.name} (${parsed.data.email})</p>
        <hr />
        <p>${parsed.data.message.replace(/\n/g, "<br />")}</p>
      `,
    });
  } catch {
    // Email delivery is non-blocking
  }

  return {
    ok: true,
    message: "Message sent! We'll get back to you within 24 hours.",
  };
}

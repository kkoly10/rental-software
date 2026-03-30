"use server";

import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export type ContactState = {
  ok: boolean;
  message: string;
};

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

  // Fire-and-forget email to the platform support
  try {
    const { sendEmail } = await import("@/lib/email/send");
    await sendEmail({
      to: "support@rentalos.com",
      subject: `Contact form: ${parsed.data.name}`,
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

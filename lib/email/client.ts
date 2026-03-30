import { Resend } from "resend";
import { getOptionalEnv } from "@/lib/env";

let resendInstance: Resend | null = null;

export function hasResendEnv(): boolean {
  return Boolean(getOptionalEnv("RESEND_API_KEY"));
}

export function getResend(): Resend {
  if (!resendInstance) {
    const key = getOptionalEnv("RESEND_API_KEY");
    if (!key) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }
    resendInstance = new Resend(key);
  }
  return resendInstance;
}

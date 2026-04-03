import { getOptionalEnv } from "@/lib/env";

type EnvService = {
  name: string;
  envVars: string[];
  required: boolean;
};

const CRITICAL_SERVICES: EnvService[] = [
  {
    name: "Supabase",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    required: true,
  },
  {
    name: "Stripe",
    envVars: ["STRIPE_SECRET_KEY"],
    required: true,
  },
  {
    name: "Resend (Email)",
    envVars: ["RESEND_API_KEY"],
    required: true,
  },
  {
    name: "Twilio (SMS)",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    required: false,
  },
];

/**
 * Returns true when critical env vars are missing and the app is
 * operating with demo/mock data instead of live services.
 */
export function isDemoMode(): boolean {
  return CRITICAL_SERVICES.filter((s) => s.required).some((service) =>
    service.envVars.some((v) => !getOptionalEnv(v))
  );
}

export type ServiceStatus = {
  name: string;
  connected: boolean;
  required: boolean;
  missingVars: string[];
};

/**
 * Returns connection status for every external service.
 */
export function getServiceStatuses(): ServiceStatus[] {
  return CRITICAL_SERVICES.map((service) => {
    const missingVars = service.envVars.filter((v) => !getOptionalEnv(v));
    return {
      name: service.name,
      connected: missingVars.length === 0,
      required: service.required,
      missingVars,
    };
  });
}

/**
 * Returns all missing env vars from required services.
 */
export function getMissingEnvVars(): string[] {
  return CRITICAL_SERVICES.filter((s) => s.required).flatMap((service) =>
    service.envVars.filter((v) => !getOptionalEnv(v))
  );
}

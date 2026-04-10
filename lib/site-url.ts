import { headers } from "next/headers";

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export async function getSiteUrl() {
  const explicit = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL
  );

  if (explicit) {
    return explicit;
  }

  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? process.env.VERCEL_URL;

  if (!host) {
    return "http://localhost:3000";
  }

  return normalizeOrigin(`${protocol}://${host}`) ?? "http://localhost:3000";
}

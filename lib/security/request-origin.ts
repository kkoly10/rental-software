import type { NextRequest } from "next/server";
import { getOptionalEnv } from "@/lib/env";

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function getConfiguredOrigins() {
  const configured = [
    getOptionalEnv("NEXT_PUBLIC_SITE_URL"),
    getOptionalEnv("SITE_URL"),
  ]
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(configured));
}

export function getRequestOrigin(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    try {
      return normalizeOrigin(new URL(refererHeader).origin);
    } catch {
      return null;
    }
  }

  return null;
}

export function isAllowedRequestOrigin(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const requestUrlOrigin = normalizeOrigin(request.nextUrl.origin);

  if (!requestOrigin) {
    return false;
  }

  if (requestOrigin === requestUrlOrigin) {
    return true;
  }

  return getConfiguredOrigins().includes(requestOrigin);
}

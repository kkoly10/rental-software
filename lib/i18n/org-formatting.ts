import "server-only";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";
import { getLocale } from "./server";
import type { Locale } from "./config";

export type OrgFormatting = {
  currency: string;
  locale: Locale | string;
};

/**
 * Resolve the currency + locale pair that dashboard surfaces should use for
 * money and date formatting. Cached per-request so callers can invoke it
 * freely without re-querying.
 */
export const getOrgFormatting = cache(async function getOrgFormatting(): Promise<OrgFormatting> {
  const locale = await getLocale();
  if (!hasSupabaseEnv()) return { currency: "USD", locale };

  const ctx = await getOrgContext();
  if (!ctx) return { currency: "USD", locale };

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("default_currency")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    currency: (org?.default_currency as string | null) ?? "USD",
    locale,
  };
});

/**
 * Storefront counterpart to getOrgFormatting(). The public storefront has no
 * operator session, so the org is resolved from the request (subdomain/domain)
 * via getPublicOrgId() rather than the auth context. Same currency + locale
 * shape so customer-facing prices match the dashboard's formatting.
 */
export const getPublicOrgFormatting = cache(async function getPublicOrgFormatting(): Promise<OrgFormatting> {
  const locale = await getLocale();
  if (!hasSupabaseEnv()) return { currency: "USD", locale };

  const organizationId = await getPublicOrgId();
  if (!organizationId) return { currency: "USD", locale };

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("default_currency")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    currency: (org?.default_currency as string | null) ?? "USD",
    locale,
  };
});

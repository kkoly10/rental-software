"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type GuidanceSnapshot = {
  businessName: string;
  supportEmail: string;
  phone: string;
  heroMessage: string;
  productsCount: number;
  productImagesCount: number;
  serviceAreasCount: number;
  ordersCount: number;
  paymentsCount: number;
  documentsCount: number;
  hasBusinessProfile: boolean;
  hasWebsiteSettings: boolean;
};

const emptySnapshot: GuidanceSnapshot = {
  businessName: "",
  supportEmail: "",
  phone: "",
  heroMessage: "",
  productsCount: 0,
  productImagesCount: 0,
  serviceAreasCount: 0,
  ordersCount: 0,
  paymentsCount: 0,
  documentsCount: 0,
  hasBusinessProfile: false,
  hasWebsiteSettings: false,
};

export async function getGuidanceSnapshot(): Promise<GuidanceSnapshot> {
  if (!hasSupabaseEnv()) return emptySnapshot;

  const ctx = await getOrgContext();
  if (!ctx) return emptySnapshot;

  const supabase = await createSupabaseServerClient();

  const [orgResult, productsResult, imagesResult, areasResult, ordersResult, paymentsResult, documentsResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, support_email, phone, settings")
        .eq("id", ctx.organizationId)
        .maybeSingle(),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId),
      supabase
        .from("product_images")
        .select("id, products!inner(organization_id)", { count: "exact", head: true })
        .eq("products.organization_id", ctx.organizationId),
      supabase
        .from("service_areas")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("is_active", true),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId),
      supabase
        .from("payments")
        .select("id, orders!inner(organization_id)", { count: "exact", head: true })
        .eq("orders.organization_id", ctx.organizationId),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId),
    ]);

  const org = orgResult.data;
  const settings = (org?.settings as Record<string, unknown>) ?? {};

  const businessName = org?.name ?? "";
  const supportEmail = org?.support_email ?? "";
  const phone = org?.phone ?? "";
  const heroMessage = (settings.hero_message as string) ?? "";

  return {
    businessName,
    supportEmail,
    phone,
    heroMessage,
    productsCount: productsResult.count ?? 0,
    productImagesCount: imagesResult.count ?? 0,
    serviceAreasCount: areasResult.count ?? 0,
    ordersCount: ordersResult.count ?? 0,
    paymentsCount: paymentsResult.count ?? 0,
    documentsCount: documentsResult.count ?? 0,
    hasBusinessProfile: Boolean(businessName && (supportEmail || phone)),
    hasWebsiteSettings: Boolean(heroMessage),
  };
}

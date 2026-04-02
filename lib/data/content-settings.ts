import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";

export type ContentSettings = {
  customFaq: { question: string; answer: string }[];
  aboutText: string;
  testimonials: { name: string; text: string; rating: number }[];
  trustBadges: { title: string; description: string }[];
  sectionVisibility: Record<string, boolean>;
};

const defaultVisibility: Record<string, boolean> = {
  trust_bar: true,
  pain_points: true,
  benefits: true,
  category_grid: true,
  how_it_works: true,
  feature_showcase: true,
  integrations_bar: true,
  faq_section: true,
  about_section: false,
  testimonials: false,
  service_area_map: true,
};

const fallbackContent: ContentSettings = {
  customFaq: [],
  aboutText: "",
  testimonials: [],
  trustBadges: [],
  sectionVisibility: defaultVisibility,
};

export async function getContentSettings(): Promise<ContentSettings> {
  if (!hasSupabaseEnv()) return fallbackContent;

  const ctx = await getOrgContext();
  const organizationId = ctx?.organizationId ?? (await getPublicOrgId());
  if (!organizationId) return fallbackContent;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return fallbackContent;

  const settings = (data.settings as Record<string, unknown>) ?? {};

  return {
    customFaq: (settings.custom_faq as ContentSettings["customFaq"]) ?? [],
    aboutText: (settings.about_text as string) ?? "",
    testimonials:
      (settings.testimonials as ContentSettings["testimonials"]) ?? [],
    trustBadges:
      (settings.trust_badges as ContentSettings["trustBadges"]) ?? [],
    sectionVisibility: {
      ...defaultVisibility,
      ...((settings.section_visibility as Record<string, boolean>) ?? {}),
    },
  };
}

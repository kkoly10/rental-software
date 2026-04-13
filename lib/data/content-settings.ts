import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";

export type NavLink = {
  key: string;
  label: string;
  href: string;
  visible: boolean;
};

export const defaultNavLinks: NavLink[] = [
  { key: "catalog", label: "Catalog", href: "/inventory", visible: true },
  { key: "how_it_works", label: "How It Works", href: "/#how-it-works", visible: true },
  { key: "service_area", label: "Service Area", href: "/#service-area", visible: true },
  { key: "pricing", label: "Pricing", href: "/pricing", visible: true },
  { key: "order_status", label: "Order Status", href: "/order-status", visible: true },
  { key: "contact", label: "Contact", href: "/contact", visible: true },
];

export type ContentSettings = {
  customFaq: { question: string; answer: string }[];
  aboutText: string;
  testimonials: { name: string; text: string; rating: number }[];
  trustBadges: { title: string; description: string }[];
  sectionVisibility: Record<string, boolean>;
  navLinks: NavLink[];
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
  navLinks: defaultNavLinks,
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

  // Merge stored nav_links with defaults so new links added in code
  // appear automatically for tenants who haven't customised yet.
  const storedNav = (settings.nav_links as NavLink[] | undefined) ?? null;
  let navLinks: NavLink[];
  if (storedNav) {
    const storedMap = new Map(storedNav.map((l) => [l.key, l]));
    navLinks = defaultNavLinks.map((d) => storedMap.get(d.key) ?? d);
  } else {
    navLinks = defaultNavLinks;
  }

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
    navLinks,
  };
}

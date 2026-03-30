type FallbackKey = "bounce" | "water" | "combo" | "obstacle" | "package";

const IMAGE_MAP: Record<FallbackKey, string> = {
  bounce:
    "https://images.unsplash.com/photo-1578430554430-1c59f56bd817?auto=format&fit=crop&w=800&q=80",
  water:
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=800&q=80",
  combo:
    "https://images.unsplash.com/photo-1633846802535-75fafbcf9043?auto=format&fit=crop&w=800&q=80",
  obstacle:
    "https://images.unsplash.com/photo-1633846804415-78105890e73f?auto=format&fit=crop&w=800&q=80",
  package:
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80",
};

function resolveFallbackKey(slug?: string, category?: string): FallbackKey {
  const slugValue = slug?.toLowerCase() ?? "";
  const categoryValue = category?.toLowerCase() ?? "";

  if (slugValue.includes("water") || categoryValue.includes("water")) {
    return "water";
  }

  if (slugValue.includes("combo") || categoryValue.includes("combo")) {
    return "combo";
  }

  if (slugValue.includes("obstacle") || categoryValue.includes("obstacle")) {
    return "obstacle";
  }

  if (slugValue.includes("package") || categoryValue.includes("package")) {
    return "package";
  }

  return "bounce";
}

export function getStorefrontFallbackImage(
  slug?: string,
  category?: string
): string {
  const key = resolveFallbackKey(slug, category);
  return IMAGE_MAP[key];
}

export function getStorefrontFallbackGallery(
  slug?: string,
  category?: string
): string[] {
  const key = resolveFallbackKey(slug, category);
  const image = IMAGE_MAP[key];
  return [image, image, image, image];
}

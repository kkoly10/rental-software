type FallbackKey = "bounce" | "water" | "combo" | "obstacle" | "package";

const IMAGE_MAP: Record<FallbackKey, string> = {
  bounce: "/placeholders/bounce-house.svg",
  water: "/placeholders/water-slide.svg",
  combo: "/placeholders/combo-unit.svg",
  obstacle: "/placeholders/obstacle-course.svg",
  package: "/placeholders/party-package.svg",
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

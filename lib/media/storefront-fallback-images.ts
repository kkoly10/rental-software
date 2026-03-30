type FallbackKey = "bounce" | "water" | "combo" | "obstacle" | "package";

const IMAGE_MAP: Record<FallbackKey, string> = {
  bounce:
    "https://cdn.pixabay.com/photo/2018/07/28/00/05/bouncy-castles-3567019_1280.jpg",
  water:
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=800&q=80",
  combo:
    "https://cdn.pixabay.com/photo/2023/11/03/15/19/girl-8363280_1280.jpg",
  obstacle:
    "https://cdn.pixabay.com/photo/2016/06/14/03/03/inflatable-obstacle-course-1455632_1280.jpg",
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

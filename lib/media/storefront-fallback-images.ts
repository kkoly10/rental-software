const UNSPLASH_IMAGES = {
  bounce: {
    image:
      "https://unsplash.com/photos/a_hMEPZUmOM/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/a_hMEPZUmOM/download?force=true&w=1400",
      "https://unsplash.com/photos/V7E7VCFLzPo/download?force=true&w=1400",
      "https://unsplash.com/photos/vi8gZmGtGik/download?force=true&w=1400",
      "https://unsplash.com/photos/LMtSyylPBPI/download?force=true&w=1400",
    ],
  },
  water: {
    image:
      "https://unsplash.com/photos/zD1vrOiZbHY/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/zD1vrOiZbHY/download?force=true&w=1400",
      "https://unsplash.com/photos/G1FuL-U2JrQ/download?force=true&w=1400",
      "https://unsplash.com/photos/5w5Insl072o/download?force=true&w=1400",
      "https://unsplash.com/photos/o9JdBuxZwv0/download?force=true&w=1400",
    ],
  },
  combo: {
    image:
      "https://unsplash.com/photos/--IYY9bkSCAg/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/--IYY9bkSCAg/download?force=true&w=1400",
      "https://unsplash.com/photos/o9JdBuxZwv0/download?force=true&w=1400",
      "https://unsplash.com/photos/f70xmbPyjKU/download?force=true&w=1400",
      "https://unsplash.com/photos/V7E7VCFLzPo/download?force=true&w=1400",
    ],
  },
  obstacle: {
    image:
      "https://unsplash.com/photos/o9JdBuxZwv0/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/o9JdBuxZwv0/download?force=true&w=1400",
      "https://unsplash.com/photos/--IYY9bkSCAg/download?force=true&w=1400",
      "https://unsplash.com/photos/G1FuL-U2JrQ/download?force=true&w=1400",
      "https://unsplash.com/photos/zD1vrOiZbHY/download?force=true&w=1400",
    ],
  },
  package: {
    image:
      "https://unsplash.com/photos/V7E7VCFLzPo/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/V7E7VCFLzPo/download?force=true&w=1400",
      "https://unsplash.com/photos/a_hMEPZUmOM/download?force=true&w=1400",
      "https://unsplash.com/photos/--IYY9bkSCAg/download?force=true&w=1400",
      "https://unsplash.com/photos/o9JdBuxZwv0/download?force=true&w=1400",
    ],
  },
} as const;

function resolveFallbackKey(slug?: string, category?: string) {
  const slugValue = slug?.toLowerCase() ?? "";
  const categoryValue = category?.toLowerCase() ?? "";

  if (
    slugValue.includes("water") ||
    categoryValue.includes("water")
  ) {
    return "water";
  }

  if (
    slugValue.includes("combo") ||
    categoryValue.includes("combo")
  ) {
    return "combo";
  }

  if (
    slugValue.includes("obstacle") ||
    categoryValue.includes("obstacle")
  ) {
    return "obstacle";
  }

  if (
    slugValue.includes("package") ||
    categoryValue.includes("package")
  ) {
    return "package";
  }

  return "bounce";
}

export function getStorefrontFallbackImage(slug?: string, category?: string) {
  const key = resolveFallbackKey(slug, category);
  return UNSPLASH_IMAGES[key].image;
}

export function getStorefrontFallbackGallery(
  slug?: string,
  category?: string
) {
  const key = resolveFallbackKey(slug, category);
  return UNSPLASH_IMAGES[key].gallery;
}
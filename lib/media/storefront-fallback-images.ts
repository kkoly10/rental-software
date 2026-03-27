const UNSPLASH_IMAGES = {
  bounce: {
    image:
      "https://unsplash.com/photos/a-red-inflatable-castle-bounce-house-on-a-grassy-lawn-a_hMEPZUmOM/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/a-red-inflatable-castle-bounce-house-on-a-grassy-lawn-a_hMEPZUmOM/download?force=true&w=1400",
      "https://unsplash.com/photos/childrens-inflatable-bounce-house-set-up-in-a-park-V7E7VCFLzPo/download?force=true&w=1400",
      "https://unsplash.com/photos/a-child-walks-away-from-the-camera-towards-a-party-J4X6lWj3ARs/download?force=true&w=1400",
      "https://unsplash.com/photos/a-woman-is-playing-in-an-inflatable-park--IYY9bkSCAg/download?force=true&w=1400",
    ],
  },
  water: {
    image:
      "https://unsplash.com/photos/an-aerial-view-of-an-inflatable-water-slide-zD1vrOiZbHY/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/an-aerial-view-of-an-inflatable-water-slide-zD1vrOiZbHY/download?force=true&w=1400",
      "https://unsplash.com/photos/a-young-man-sliding-down-an-inflatable-slide-G1FuL-U2JrQ/download?force=true&w=1400",
      "https://unsplash.com/photos/an-aerial-view-of-an-inflatable-water-slide-PnfrGF9LnIc/download?force=true&w=1400",
      "https://unsplash.com/photos/a-woman-is-playing-in-an-inflatable-park--IYY9bkSCAg/download?force=true&w=1400",
    ],
  },
  combo: {
    image:
      "https://unsplash.com/photos/a-woman-is-playing-in-an-inflatable-park--IYY9bkSCAg/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/a-woman-is-playing-in-an-inflatable-park--IYY9bkSCAg/download?force=true&w=1400",
      "https://unsplash.com/photos/childrens-inflatable-bounce-house-set-up-in-a-park-V7E7VCFLzPo/download?force=true&w=1400",
      "https://unsplash.com/photos/a-red-inflatable-castle-bounce-house-on-a-grassy-lawn-a_hMEPZUmOM/download?force=true&w=1400",
      "https://unsplash.com/photos/a-young-man-sliding-down-an-inflatable-slide-G1FuL-U2JrQ/download?force=true&w=1400",
    ],
  },
  obstacle: {
    image:
      "https://unsplash.com/photos/a-young-man-sliding-down-an-inflatable-slide-G1FuL-U2JrQ/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/a-young-man-sliding-down-an-inflatable-slide-G1FuL-U2JrQ/download?force=true&w=1400",
      "https://unsplash.com/photos/a-woman-is-playing-in-an-inflatable-park--IYY9bkSCAg/download?force=true&w=1400",
      "https://unsplash.com/photos/childrens-inflatable-bounce-house-set-up-in-a-park-V7E7VCFLzPo/download?force=true&w=1400",
      "https://unsplash.com/photos/an-aerial-view-of-an-inflatable-water-slide-zD1vrOiZbHY/download?force=true&w=1400",
    ],
  },
  package: {
    image:
      "https://unsplash.com/photos/a-decorated-event-space-with-tables-and-balloons-Cfz5r15fKdU/download?force=true&w=1400",
    gallery: [
      "https://unsplash.com/photos/a-decorated-event-space-with-tables-and-balloons-Cfz5r15fKdU/download?force=true&w=1400",
      "https://unsplash.com/photos/lion-themed-birthday-party-decorations-with-balloons-and-balloons-WTzhzt-5SMw/download?force=true&w=1400",
      "https://unsplash.com/photos/unicorn-themed-birthday-party-decorations-with-balloons-and-balloons-4vgVHZHVQos/download?force=true&w=1400",
      "https://unsplash.com/photos/a-festive-birthday-celebration-decorated-with-balloons-D31ZvQgI9z8/download?force=true&w=1400",
    ],
  },
} as const;

function resolveFallbackKey(slug?: string, category?: string) {
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

export function getStorefrontFallbackImage(slug?: string, category?: string) {
  const key = resolveFallbackKey(slug, category);
  return UNSPLASH_IMAGES[key].image;
}

export function getStorefrontFallbackGallery(
  slug?: string,
  category?: string
): string[] {
  const key = resolveFallbackKey(slug, category);
  return [...UNSPLASH_IMAGES[key].gallery];
}
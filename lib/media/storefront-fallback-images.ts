type FallbackKey =
  | "bounce"
  | "water"
  | "combo"
  | "obstacle"
  | "package"
  | "tent"
  | "chair-table"
  | "dance-floor"
  | "photo-booth"
  | "concession";

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
  // The non-inflatable verticals use SVG gradient data-URIs (no
  // external CDN, no 404 risk) until the operator uploads a real
  // photo. They render as soft branded panels that read as "this
  // tile is intentionally placeholder" — better than serving a
  // bounce-house photo on a Frame Tent product card.
  tent: gradientDataUri("#0e7490", "#155e75", "Tent"),
  "chair-table": gradientDataUri("#b45309", "#7c2d12", "Chairs & Tables"),
  "dance-floor": gradientDataUri("#a21caf", "#86198f", "Dance Floor"),
  "photo-booth": gradientDataUri("#7c3aed", "#5b21b6", "Photo Booth"),
  concession: gradientDataUri("#dc2626", "#991b1b", "Concessions"),
};

function gradientDataUri(from: string, to: string, label: string): string {
  // 800x600 SVG gradient with a centered label. data-URI keeps the
  // dependency surface zero and survives offline / strict-CSP setups.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${from}"/>
    <stop offset="100%" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <text x="400" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="600" fill="rgba(255,255,255,0.92)" text-anchor="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function resolveFallbackKey(slug?: string, category?: string): FallbackKey {
  const slugValue = slug?.toLowerCase() ?? "";
  const categoryValue = category?.toLowerCase() ?? "";
  const haystack = `${slugValue} ${categoryValue}`;

  // Order matters — more specific matches first. "dance floor" must
  // beat the generic "floor", and the tent / chair / table buckets
  // need their own branches before bounce/water/combo fallthrough so
  // a "Frame Tent" or "Chiavari Chair" doesn't get bounce-house art.
  if (/\bdance\b|\bstage\b/.test(haystack)) {
    return "dance-floor";
  }

  if (/\btent\b|\bsidewall/.test(haystack)) {
    return "tent";
  }

  if (/\bchair\b|\btable\b|\blinen/.test(haystack)) {
    return "chair-table";
  }

  // Photo-booth + concessions keywords must come before the bouncer
  // fallthrough — "selfie pod" or "popcorn machine" otherwise lands on
  // bounce-house art.
  if (/\bphoto\s*booth\b|\bselfie\b|\b360\b|\bmirror\s*booth\b/.test(haystack)) {
    return "photo-booth";
  }

  if (
    /\bpopcorn\b|\bsnow\s*cone\b|\bcotton\s*candy\b|\bhot\s*dog\b|\bfrozen\s*drink\b|\bconcession/.test(
      haystack,
    )
  ) {
    return "concession";
  }

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

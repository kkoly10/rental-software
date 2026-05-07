const CATEGORY_PLACEHOLDER: Record<string, string> = {
  "bounce houses": "/placeholders/bounce-house.png",
  "obstacle courses": "/placeholders/obstacle-course.png",
  "combo units": "/placeholders/combo-unit.png",
  "packages": "/placeholders/party-package.png",
  "party packages": "/placeholders/party-package.png",
  "water slides": "/placeholders/water-slide.png",
};

export function getPlaceholderImage(category: string): string {
  return CATEGORY_PLACEHOLDER[category.toLowerCase()] ?? "/placeholders/bounce-house.png";
}

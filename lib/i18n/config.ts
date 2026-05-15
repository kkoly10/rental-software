export const LOCALES = ["en", "fr", "es", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined | null): Locale {
  if (isLocale(value)) return value;
  if (!value) return DEFAULT_LOCALE;
  const base = value.split("-")[0]?.toLowerCase();
  if (isLocale(base)) return base;
  return DEFAULT_LOCALE;
}

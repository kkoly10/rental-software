import { en, type Messages } from "./messages/en";
import { fr } from "./messages/fr";
import { es } from "./messages/es";
import { pt } from "./messages/pt";
import type { Locale } from "./config";

export const dictionaries: Record<Locale, Messages> = {
  en,
  fr,
  es,
  pt,
};

export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries.en;
}

export type { Messages };

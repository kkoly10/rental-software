import "server-only";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  resolveLocale,
  type Locale,
} from "./config";
import { getDictionary, type Messages } from "./dictionaries";
import { formatMessage } from "./format";

export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    if (cookieLocale) {
      return resolveLocale(cookieLocale);
    }
  } catch {
    // cookies() can throw in some edge contexts — fall back to header
  }

  try {
    const hdrs = await headers();
    const accept = hdrs.get("accept-language");
    if (accept) {
      const first = accept.split(",")[0]?.split(";")[0]?.trim();
      if (first) return resolveLocale(first);
    }
  } catch {
    // headers() also unavailable — return default
  }

  return DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return getDictionary(await getLocale());
}

export async function getTranslator() {
  const locale = await getLocale();
  const messages = getDictionary(locale);
  return {
    locale,
    messages,
    t: (template: string, values?: Record<string, string | number>) =>
      formatMessage(template, values),
  };
}

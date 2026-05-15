"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import { dictionaries, type Messages } from "./dictionaries";
import { formatMessage } from "./format";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const messages = dictionaries[locale] ?? dictionaries.en;
  return (
    <I18nContext.Provider value={{ locale, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      messages: dictionaries.en,
      t: (template: string, values?: Record<string, string | number>) =>
        formatMessage(template, values),
    };
  }
  return {
    locale: ctx.locale,
    messages: ctx.messages,
    t: (template: string, values?: Record<string, string | number>) =>
      formatMessage(template, values),
  };
}

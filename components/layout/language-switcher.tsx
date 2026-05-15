"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/actions";

const SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  es: "ES",
  pt: "PT",
};

interface LanguageSwitcherProps {
  currentLocale: Locale;
  className?: string;
  ariaLabel?: string;
  /** Show a compact "EN/FR/ES/PT" code instead of the full name. */
  compact?: boolean;
}

export function LanguageSwitcher({
  currentLocale,
  className,
  ariaLabel,
  compact = false,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className={className} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="sr-only">{ariaLabel ?? "Language"}</span>
      <select
        aria-label={ariaLabel ?? "Language"}
        value={currentLocale}
        disabled={pending}
        onChange={(e) => {
          const next = e.currentTarget.value;
          const formData = new FormData();
          formData.set("locale", next);
          startTransition(async () => {
            await setLocale(formData);
            router.refresh();
          });
        }}
        style={{
          background: "transparent",
          border: "1px solid rgba(0,0,0,.12)",
          borderRadius: 8,
          padding: compact ? "6px 8px" : "6px 10px",
          font: "inherit",
          fontSize: compact ? "0.85rem" : undefined,
          fontWeight: compact ? 600 : undefined,
          color: "inherit",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {compact ? SHORT_LABELS[l] : LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

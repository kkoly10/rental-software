"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/actions";

export function LanguageSwitcher({
  currentLocale,
  className,
  ariaLabel,
}: {
  currentLocale: Locale;
  className?: string;
  ariaLabel?: string;
}) {
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
          padding: "6px 10px",
          font: "inherit",
          color: "inherit",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

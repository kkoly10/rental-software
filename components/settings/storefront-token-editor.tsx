"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  CURATED_FONTS,
  SCALE_RATIOS,
  type ThemeTokens,
} from "@/lib/data/storefront-tokens-schema";
import { contrastRatio } from "@/lib/utils/contrast";
import {
  saveStorefrontDraft,
  publishStorefront,
  type StorefrontPageActionState,
} from "@/lib/settings/storefront-page-actions";

const initialState: StorefrontPageActionState = { ok: false, message: "" };

type ColorKey = keyof ThemeTokens["colors"];

const COLOR_KEYS: ColorKey[] = [
  "background",
  "surface",
  "text",
  "textMuted",
  "primary",
  "accent",
];

const FONT_STACKS: Record<string, string> = {
  "Plus Jakarta Sans": '"Plus Jakarta Sans", sans-serif',
  Sora: '"Sora", sans-serif',
  Inter: '"Inter", sans-serif',
  Poppins: '"Poppins", sans-serif',
  Montserrat: '"Montserrat", sans-serif',
  "Playfair Display": '"Playfair Display", Georgia, serif',
  Roboto: '"Roboto", sans-serif',
};

export function StorefrontTokenEditor({ initialTokens }: { initialTokens: ThemeTokens }) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder;

  const [tokens, setTokens] = useState<ThemeTokens>(initialTokens);

  const [draftState, draftAction, draftPending] = useActionState(
    saveStorefrontDraft,
    initialState
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishStorefront,
    initialState
  );

  const setColor = (key: ColorKey, value: string) =>
    setTokens((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  const setTypography = <K extends keyof ThemeTokens["typography"]>(
    key: K,
    value: ThemeTokens["typography"][K]
  ) => setTokens((t) => ({ ...t, typography: { ...t.typography, [key]: value } }));

  // Inline contrast checks (the same pairs the server enforces on publish).
  const textOnBg = contrastRatio(tokens.colors.text, tokens.colors.background);
  const primaryOnBg = contrastRatio(tokens.colors.primary, tokens.colors.background);
  const lowContrast = textOnBg < 4.5 || primaryOnBg < 4.5;

  const tokensJson = JSON.stringify(tokens);

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  };
  const fieldStyle: React.CSSProperties = { marginBottom: 16 };

  // Inline CSS variables driving the live preview wrapper.
  const previewVars = {
    "--prev-bg": tokens.colors.background,
    "--prev-surface": tokens.colors.surface,
    "--prev-text": tokens.colors.text,
    "--prev-muted": tokens.colors.textMuted,
    "--prev-primary": tokens.colors.primary,
    "--prev-accent": tokens.colors.accent,
    "--prev-radius": `${tokens.radius}px`,
    "--prev-heading-font": FONT_STACKS[tokens.typography.headingFont] ?? "serif",
    "--prev-body-font": FONT_STACKS[tokens.typography.bodyFont] ?? "sans-serif",
    "--prev-base": `${tokens.typography.baseSizePx}px`,
  } as React.CSSProperties;

  const colorRow = (key: ColorKey) => (
    <div key={key} style={fieldStyle}>
      <label style={labelStyle} htmlFor={`color-${key}`}>
        {m[key]}
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          id={`color-${key}`}
          type="color"
          value={normalizeHex(tokens.colors[key])}
          onChange={(e) => setColor(key, e.target.value)}
          style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "none" }}
          aria-label={m[key]}
        />
        <input
          type="text"
          value={tokens.colors[key]}
          onChange={(e) => setColor(key, e.target.value)}
          spellCheck={false}
          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontFamily: "monospace", fontSize: 13 }}
          aria-label={`${m[key]} hex`}
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }} className="storefront-builder-grid">
      {/* ── Controls ── */}
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{m.colorsHeading}</h3>
        {COLOR_KEYS.map(colorRow)}

        <h3 style={{ margin: "20px 0 12px", fontSize: 15 }}>{m.typographyHeading}</h3>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="headingFont">{m.headingFont}</label>
          <select
            id="headingFont"
            value={tokens.typography.headingFont}
            onChange={(e) => setTypography("headingFont", e.target.value as ThemeTokens["typography"]["headingFont"])}
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}
          >
            {CURATED_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="bodyFont">{m.bodyFont}</label>
          <select
            id="bodyFont"
            value={tokens.typography.bodyFont}
            onChange={(e) => setTypography("bodyFont", e.target.value as ThemeTokens["typography"]["bodyFont"])}
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}
          >
            {CURATED_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="baseSize">
            {m.baseSize}: {tokens.typography.baseSizePx}px
          </label>
          <input
            id="baseSize"
            type="range"
            min={15}
            max={18}
            step={1}
            value={tokens.typography.baseSizePx}
            onChange={(e) => setTypography("baseSizePx", Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="scaleRatio">{m.scaleRatio}</label>
          <select
            id="scaleRatio"
            value={tokens.typography.scaleRatio}
            onChange={(e) => setTypography("scaleRatio", Number(e.target.value))}
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}
          >
            {SCALE_RATIOS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <h3 style={{ margin: "20px 0 12px", fontSize: 15 }}>{m.shapeHeading}</h3>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="radius">
            {m.radius}: {tokens.radius}px
          </label>
          <input
            id="radius"
            type="range"
            min={0}
            max={24}
            step={1}
            value={tokens.radius}
            onChange={(e) => setTokens((t) => ({ ...t, radius: Number(e.target.value) }))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {/* ── Live preview + actions ── */}
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{m.previewHeading}</h3>
        <div
          style={{
            ...previewVars,
            background: "var(--prev-bg)",
            color: "var(--prev-text)",
            borderRadius: "var(--prev-radius)",
            border: "1px solid var(--border)",
            padding: 24,
            fontFamily: "var(--prev-body-font)",
            fontSize: "var(--prev-base)",
          }}
        >
          <div
            style={{
              background: "var(--prev-surface)",
              borderRadius: "var(--prev-radius)",
              padding: 20,
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "var(--prev-primary)", fontWeight: 700 }}>
              {m.previewKicker}
            </div>
            <h2 style={{ fontFamily: "var(--prev-heading-font)", margin: "8px 0", color: "var(--prev-text)" }}>
              {m.previewTitle}
            </h2>
            <p style={{ color: "var(--prev-muted)", margin: "0 0 16px" }}>{m.previewBody}</p>
            <button
              type="button"
              style={{
                background: "var(--prev-primary)",
                color: "var(--prev-surface)",
                border: "none",
                borderRadius: "var(--prev-radius)",
                padding: "10px 18px",
                fontWeight: 600,
                cursor: "default",
              }}
            >
              {m.previewButton}
            </button>
          </div>
        </div>

        {lowContrast && (
          <div className="badge warning" style={{ padding: "10px 14px", marginTop: 12 }}>
            {m.contrastWarning}
          </div>
        )}

        {/* Two server-action forms sharing the live token JSON. */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <form action={draftAction}>
            <input type="hidden" name="tokens_json" value={tokensJson} />
            <button type="submit" className="secondary-btn" disabled={draftPending}>
              {draftPending ? m.savingDraft : m.saveDraft}
            </button>
          </form>
          <form action={publishAction}>
            <input type="hidden" name="tokens_json" value={tokensJson} />
            <button type="submit" className="primary-btn" disabled={publishPending}>
              {publishPending ? m.publishing : m.publish}
            </button>
          </form>
        </div>

        {draftState.message && (
          <div className={draftState.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px", marginTop: 12 }}>
            {draftState.message}
          </div>
        )}
        {publishState.message && (
          <div className={publishState.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px", marginTop: 12 }}>
            {publishState.message}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * `<input type=color>` only accepts #RRGGBB. The schema also allows #RGB and
 * #RRGGBBAA; coerce to a 6-digit value for the swatch (the text input keeps the
 * authoritative value).
 */
function normalizeHex(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return "#" + cleaned.split("").map((c) => c + c).join("");
  }
  if (cleaned.length >= 6) {
    return "#" + cleaned.slice(0, 6);
  }
  return "#000000";
}

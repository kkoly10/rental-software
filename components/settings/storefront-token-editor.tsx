"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  CURATED_FONTS,
  type ThemeTokens,
} from "@/lib/data/storefront-tokens-schema";
import { contrastRatio } from "@/lib/utils/contrast";

type ColorKey = keyof ThemeTokens["colors"];

const COLOR_KEYS: ColorKey[] = [
  "background",
  "surface",
  "text",
  "textMuted",
  "primary",
  "accent",
];

/**
 * NOOB-friendly preset palettes per color role (PR-2c). Non-designers click a
 * preset swatch instead of typing hex; the raw hex input stays available behind
 * a "Custom…" expander. Light roles (background/surface) get light presets;
 * text/muted get neutrals; primary/accent get brand-ish hues.
 */
const COLOR_PRESETS: Record<ColorKey, string[]> = {
  background: ["#FFFFFF", "#FAFAF7", "#F5F5F4", "#1A1A1A", "#0F172A"],
  surface: ["#FFFFFF", "#F8FAFC", "#F3F4F6", "#1F2937", "#111827"],
  text: ["#1A1A1A", "#111827", "#0F172A", "#374151", "#FFFFFF"],
  textMuted: ["#6B7280", "#9CA3AF", "#7C7C7C", "#94A3B8", "#A1A1AA"],
  primary: ["#3F4A33", "#C0392B", "#E0A82E", "#2E86C1", "#27AE60", "#7C3AED"],
  accent: ["#E0A82E", "#C0392B", "#2E86C1", "#27AE60", "#7C3AED", "#0EA5E9"],
};

/** Base text size presets (px) within the schema's 15–18 range. */
const BASE_SIZE_PRESETS = [
  { key: "small", px: 15 },
  { key: "default", px: 16 },
  { key: "large", px: 18 },
] as const;

/** Corner radius presets (px) within the schema's 0–24 range. */
const RADIUS_PRESETS = [
  { key: "sharp", px: 0 },
  { key: "soft", px: 8 },
  { key: "rounded", px: 16 },
] as const;

const FONT_STACKS: Record<string, string> = {
  "Plus Jakarta Sans": '"Plus Jakarta Sans", sans-serif',
  Sora: '"Sora", sans-serif',
  Inter: '"Inter", sans-serif',
  Poppins: '"Poppins", sans-serif',
  Montserrat: '"Montserrat", sans-serif',
  "Playfair Display": '"Playfair Display", Georgia, serif',
  Roboto: '"Roboto", sans-serif',
};

/**
 * The storefront THEME controls (colors / fonts / size / radius) — PR-2c
 * redesign. Single-column, grouped layout sized for the on-canvas Styles drawer:
 * a compact live preview pinned at the top, then Colors / Typography / Shape
 * groups, each control carrying plain-language help text (tooltips for noobs) and
 * a visual affordance (color swatches, live font previews). CONTROLLED — feeds
 * the shared builder document via `onChange`; it owns no state and no save form.
 */
export function StorefrontTokenEditor({
  tokens,
  onChange,
}: {
  tokens: ThemeTokens;
  onChange: (next: ThemeTokens) => void;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder;
  const help = m.styleHelp;

  // Which color roles have the raw-hex "Custom…" input expanded. Default: all
  // collapsed so non-designers see only swatches.
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({});
  const toggleCustom = (key: ColorKey) =>
    setCustomOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const setColor = (key: ColorKey, value: string) =>
    onChange({ ...tokens, colors: { ...tokens.colors, [key]: value } });
  const setTypography = <K extends keyof ThemeTokens["typography"]>(
    key: K,
    value: ThemeTokens["typography"][K]
  ) =>
    onChange({
      ...tokens,
      typography: { ...tokens.typography, [key]: value },
    });

  // Inline contrast checks (the same pairs the server enforces on publish).
  const textOnBg = contrastRatio(tokens.colors.text, tokens.colors.background);
  const primaryOnBg = contrastRatio(tokens.colors.primary, tokens.colors.background);
  const lowContrast = textOnBg < 4.5 || primaryOnBg < 4.5;

  // CSS variables driving the live preview card.
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

  const headingStack = FONT_STACKS[tokens.typography.headingFont] ?? "serif";
  const bodyStack = FONT_STACKS[tokens.typography.bodyFont] ?? "sans-serif";

  return (
    <div className="st-style-editor">
      <p className="st-style-intro">{help.intro}</p>

      {/* ── Live preview (pinned at the top so edits are visible instantly) ── */}
      <div
        className="st-style-preview"
        style={{
          ...previewVars,
          background: "var(--prev-bg)",
          color: "var(--prev-text)",
          borderRadius: "var(--prev-radius)",
          fontFamily: "var(--prev-body-font)",
          fontSize: "var(--prev-base)",
        }}
      >
        <div
          style={{
            background: "var(--prev-surface)",
            borderRadius: "var(--prev-radius)",
            padding: 16,
          }}
        >
          <div className="st-style-preview-kicker" style={{ color: "var(--prev-primary)" }}>
            {m.previewKicker}
          </div>
          <h2
            style={{
              fontFamily: "var(--prev-heading-font)",
              margin: "6px 0",
              color: "var(--prev-text)",
              fontSize: "1.4em",
            }}
          >
            {m.previewTitle}
          </h2>
          <p style={{ color: "var(--prev-muted)", margin: "0 0 14px" }}>
            {m.previewBody}
          </p>
          <button
            type="button"
            tabIndex={-1}
            style={{
              background: "var(--prev-primary)",
              color: "var(--prev-surface)",
              border: "none",
              borderRadius: "var(--prev-radius)",
              padding: "9px 16px",
              fontWeight: 600,
              cursor: "default",
            }}
          >
            {m.previewButton}
          </button>
        </div>
      </div>

      {lowContrast && (
        <div className="st-style-contrast" role="alert">
          {m.contrastWarning}
        </div>
      )}

      {/* ── Colors (NOOB-friendly: big swatch + preset palette; raw hex behind
            a "Custom…" expander) ── */}
      <section className="st-style-group">
        <h3 className="st-style-group-title">{m.colorsHeading}</h3>
        {COLOR_KEYS.map((key) => {
          const current = tokens.colors[key];
          const isCustomOpen = customOpen[key] === true;
          return (
            <div key={key} className="st-style-field">
              <div className="st-style-color-row">
                <span
                  className="st-style-swatch-preview"
                  aria-hidden="true"
                  style={{ background: normalizeHex(current) }}
                />
                <div className="st-style-color-meta">
                  <span className="st-style-label">{m[key]}</span>
                  <p className="st-style-help">{help[key]}</p>
                </div>
              </div>
              <div
                className="st-style-preset-row"
                role="group"
                aria-label={m[key]}
              >
                {COLOR_PRESETS[key].map((preset) => {
                  const active =
                    current.toLowerCase() === preset.toLowerCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`st-style-preset-swatch${active ? " is-active" : ""}`}
                      aria-pressed={active}
                      aria-label={preset}
                      title={preset}
                      style={{ background: preset }}
                      onClick={() => setColor(key, preset)}
                    />
                  );
                })}
                <button
                  type="button"
                  className={`st-style-custom-toggle${isCustomOpen ? " is-active" : ""}`}
                  aria-expanded={isCustomOpen}
                  onClick={() => toggleCustom(key)}
                >
                  {m.styleCustomToggle}
                </button>
              </div>
              {isCustomOpen && (
                <div className="st-style-custom-row">
                  <input
                    id={`color-${key}`}
                    type="color"
                    className="st-style-swatch"
                    value={normalizeHex(current)}
                    onChange={(e) => setColor(key, e.target.value)}
                    aria-label={m[key]}
                  />
                  <input
                    type="text"
                    className="st-style-hex"
                    value={current}
                    onChange={(e) => setColor(key, e.target.value)}
                    spellCheck={false}
                    aria-label={`${m[key]} hex`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Typography ── */}
      <section className="st-style-group">
        <h3 className="st-style-group-title">{m.typographyHeading}</h3>

        <div className="st-style-field">
          <label className="st-style-label" htmlFor="headingFont">
            {m.headingFont}
          </label>
          <select
            id="headingFont"
            className="st-style-select"
            value={tokens.typography.headingFont}
            onChange={(e) =>
              setTypography(
                "headingFont",
                e.target.value as ThemeTokens["typography"]["headingFont"]
              )
            }
          >
            {CURATED_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div className="st-style-font-preview" style={{ fontFamily: headingStack, fontWeight: 600 }}>
            {help.headingSample}
          </div>
          <p className="st-style-help">{help.headingFont}</p>
        </div>

        <div className="st-style-field">
          <label className="st-style-label" htmlFor="bodyFont">
            {m.bodyFont}
          </label>
          <select
            id="bodyFont"
            className="st-style-select"
            value={tokens.typography.bodyFont}
            onChange={(e) =>
              setTypography(
                "bodyFont",
                e.target.value as ThemeTokens["typography"]["bodyFont"]
              )
            }
          >
            {CURATED_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div className="st-style-font-preview" style={{ fontFamily: bodyStack, fontSize: 14 }}>
            {help.bodySample}
          </div>
          <p className="st-style-help">{help.bodyFont}</p>
        </div>

        <div className="st-style-field">
          <span className="st-style-label">{m.baseSize}</span>
          <div
            className="st-style-preset-row"
            role="group"
            aria-label={m.baseSize}
          >
            {BASE_SIZE_PRESETS.map((preset) => {
              const active = tokens.typography.baseSizePx === preset.px;
              const label =
                preset.key === "small"
                  ? m.stylePresetSmall
                  : preset.key === "large"
                    ? m.stylePresetLarge
                    : m.stylePresetDefault;
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={`st-style-preset-btn${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setTypography("baseSizePx", preset.px)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="st-style-help">{help.baseSize}</p>
        </div>
      </section>

      {/* ── Shape ── */}
      <section className="st-style-group">
        <h3 className="st-style-group-title">{m.shapeHeading}</h3>
        <div className="st-style-field">
          <span className="st-style-label">{m.radius}</span>
          <div className="st-style-radius-row">
            <div
              className="st-style-preset-row"
              role="group"
              aria-label={m.radius}
            >
              {RADIUS_PRESETS.map((preset) => {
                const active = tokens.radius === preset.px;
                const label =
                  preset.key === "sharp"
                    ? m.styleCornerSharp
                    : preset.key === "soft"
                      ? m.styleCornerSoft
                      : m.styleCornerRounded;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    className={`st-style-preset-btn${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => onChange({ ...tokens, radius: preset.px })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <span
              className="st-style-radius-chip"
              aria-hidden="true"
              style={{ borderRadius: tokens.radius }}
            />
          </div>
          <p className="st-style-help">{help.radius}</p>
        </div>
      </section>
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

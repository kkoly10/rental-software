"use client";

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

      {/* ── Colors ── */}
      <section className="st-style-group">
        <h3 className="st-style-group-title">{m.colorsHeading}</h3>
        {COLOR_KEYS.map((key) => (
          <div key={key} className="st-style-field">
            <div className="st-style-color-row">
              <input
                id={`color-${key}`}
                type="color"
                className="st-style-swatch"
                value={normalizeHex(tokens.colors[key])}
                onChange={(e) => setColor(key, e.target.value)}
                aria-label={m[key]}
              />
              <div className="st-style-color-meta">
                <label className="st-style-label" htmlFor={`color-${key}`}>
                  {m[key]}
                </label>
                <input
                  type="text"
                  className="st-style-hex"
                  value={tokens.colors[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                  spellCheck={false}
                  aria-label={`${m[key]} hex`}
                />
              </div>
            </div>
            <p className="st-style-help">{help[key]}</p>
          </div>
        ))}
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
          <div className="st-style-range-head">
            <label className="st-style-label" htmlFor="baseSize">
              {m.baseSize}
            </label>
            <span className="st-style-range-val">
              {tokens.typography.baseSizePx}px
            </span>
          </div>
          <input
            id="baseSize"
            type="range"
            className="st-style-range"
            min={15}
            max={18}
            step={1}
            value={tokens.typography.baseSizePx}
            onChange={(e) => setTypography("baseSizePx", Number(e.target.value))}
          />
          <p className="st-style-help">{help.baseSize}</p>
        </div>
      </section>

      {/* ── Shape ── */}
      <section className="st-style-group">
        <h3 className="st-style-group-title">{m.shapeHeading}</h3>
        <div className="st-style-field">
          <div className="st-style-range-head">
            <label className="st-style-label" htmlFor="radius">
              {m.radius}
            </label>
            <span className="st-style-range-val">{tokens.radius}px</span>
          </div>
          <div className="st-style-radius-row">
            <input
              id="radius"
              type="range"
              className="st-style-range"
              min={0}
              max={24}
              step={1}
              value={tokens.radius}
              onChange={(e) => onChange({ ...tokens, radius: Number(e.target.value) })}
            />
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

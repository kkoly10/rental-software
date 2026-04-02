"use client";

import { useActionState, useState } from "react";
import { updateBrandSettings } from "@/lib/settings/brand-actions";
import { LogoUpload } from "./logo-upload";

const initialState = { ok: false, message: "" };

const FONT_OPTIONS = [
  "System Default",
  "Inter",
  "Poppins",
  "Montserrat",
  "Playfair Display",
  "Roboto",
];

const GOOGLE_FONT_MAP: Record<string, string> = {
  Inter: "Inter:wght@400;500;600;700",
  Poppins: "Poppins:wght@400;500;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
  "Playfair Display": "Playfair+Display:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
};

export function BrandSettingsForm({
  defaults,
}: {
  defaults: {
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateBrandSettings, initialState);
  const [primaryColor, setPrimaryColor] = useState(defaults.primaryColor);
  const [accentColor, setAccentColor] = useState(defaults.accentColor);
  const [fontFamily, setFontFamily] = useState(defaults.fontFamily);

  const fontParam =
    fontFamily && fontFamily !== "System Default"
      ? GOOGLE_FONT_MAP[fontFamily]
      : null;

  const fontCssFamily =
    fontFamily && fontFamily !== "System Default"
      ? `"${fontFamily}", sans-serif`
      : "inherit";

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      {/* Logo Section */}
      <LogoUpload currentUrl={defaults.logoUrl} />

      {/* Brand Colors Section */}
      <div className="brand-form-section">
        <strong>Brand Colors</strong>
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          <label className="brand-color-picker">
            <span>Primary</span>
            <input
              name="brand_primary_color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 13 }}>{primaryColor}</span>
          </label>
          <label className="brand-color-picker">
            <span>Accent</span>
            <input
              name="brand_accent_color"
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 13 }}>{accentColor}</span>
          </label>
        </div>
        <div className="brand-color-preview">
          <div style={{ background: primaryColor, flex: 1, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, fontWeight: 600 }}>
            Primary
          </div>
          <div style={{ background: accentColor, flex: 1, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, fontWeight: 600 }}>
            Accent
          </div>
          <button
            type="button"
            style={{
              background: primaryColor,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "default",
            }}
          >
            Sample Button
          </button>
          <span
            style={{
              background: accentColor,
              color: "#fff",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Badge
          </span>
        </div>
      </div>

      {/* Typography Section */}
      <div className="brand-form-section">
        <strong>Typography</strong>
        {fontParam && (
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?family=${fontParam}&display=swap`}
          />
        )}
        <div style={{ marginTop: 8 }}>
          <select
            name="brand_font_family"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            style={{ width: "100%" }}
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <div className="brand-font-preview" style={{ fontFamily: fontCssFamily }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>The quick brown fox</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            jumps over the lazy dog — 0123456789
          </div>
        </div>
      </div>

      {state.message && (
        <div
          className={state.ok ? "badge success" : "badge warning"}
          style={{ padding: "10px 14px" }}
        >
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Brand Settings"}
        </button>
      </div>
    </form>
  );
}

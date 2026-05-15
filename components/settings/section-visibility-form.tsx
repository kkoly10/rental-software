"use client";

import { useActionState, useState } from "react";
import { updateSectionVisibility } from "@/lib/settings/content-actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

type SectionKey =
  | "trust_bar"
  | "category_grid"
  | "how_it_works"
  | "faq_section"
  | "about_section"
  | "testimonials"
  | "service_area_map";

const SECTION_LABEL_KEYS: {
  key: SectionKey;
  labelKey:
    | "trustBar"
    | "categoryGrid"
    | "howItWorks"
    | "faqSection"
    | "aboutSection"
    | "testimonials"
    | "serviceAreaMap";
}[] = [
  { key: "trust_bar", labelKey: "trustBar" },
  { key: "category_grid", labelKey: "categoryGrid" },
  { key: "how_it_works", labelKey: "howItWorks" },
  { key: "faq_section", labelKey: "faqSection" },
  { key: "about_section", labelKey: "aboutSection" },
  { key: "testimonials", labelKey: "testimonials" },
  { key: "service_area_map", labelKey: "serviceAreaMap" },
];

export function SectionVisibilityForm({
  defaults,
}: {
  defaults: Record<string, boolean>;
}) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(defaults);
  const [state, formAction, pending] = useActionState(updateSectionVisibility, initialState);
  const { messages } = useI18n();
  const m = messages.forms.sectionVisibility;

  function toggle(key: string) {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="visibility_json" value={JSON.stringify(visibility)} />

      <div>
        {SECTION_LABEL_KEYS.map(({ key, labelKey }) => (
          <div key={key} className="content-editor-toggle-row">
            <div>
              <strong style={{ fontSize: 14 }}>{m.sections[labelKey]}</strong>
            </div>
            <label className="sms-toggle">
              <input
                type="checkbox"
                checked={visibility[key] ?? false}
                onChange={() => toggle(key)}
              />
              <span className="sms-toggle-slider" />
            </label>
          </div>
        ))}
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px", marginTop: 12 }}>
          {state.message}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}

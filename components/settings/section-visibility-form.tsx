"use client";

import { useActionState, useState } from "react";
import { updateSectionVisibility } from "@/lib/settings/content-actions";

const initialState = { ok: false, message: "" };

const sectionLabels: { key: string; label: string }[] = [
  { key: "trust_bar", label: "Trust Bar" },
  { key: "pain_points", label: "Pain Points" },
  { key: "benefits", label: "Benefits" },
  { key: "category_grid", label: "Category Grid" },
  { key: "how_it_works", label: "How It Works" },
  { key: "feature_showcase", label: "Feature Showcase" },
  { key: "integrations_bar", label: "Integrations Bar" },
  { key: "faq_section", label: "FAQ Section" },
  { key: "about_section", label: "About Section" },
  { key: "testimonials", label: "Testimonials" },
  { key: "service_area_map", label: "Service Area Map" },
];

export function SectionVisibilityForm({
  defaults,
}: {
  defaults: Record<string, boolean>;
}) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(defaults);
  const [state, formAction, pending] = useActionState(updateSectionVisibility, initialState);

  function toggle(key: string) {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <input type="hidden" name="visibility_json" value={JSON.stringify(visibility)} />

      <div>
        {sectionLabels.map(({ key, label }) => (
          <div key={key} className="content-editor-toggle-row">
            <div>
              <strong style={{ fontSize: 14 }}>{label}</strong>
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
          {pending ? "Saving..." : "Save Visibility"}
        </button>
      </div>
    </form>
  );
}

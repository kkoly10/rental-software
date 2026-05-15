"use client";

import { useActionState } from "react";
import type { ServiceAreaActionState } from "@/lib/service-areas/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState: ServiceAreaActionState = {
  ok: false,
  message: "",
};

export function ServiceAreaForm({
  title,
  action,
  submitLabel,
  area,
}: {
  title: string;
  action: (prevState: ServiceAreaActionState, formData: FormData) => Promise<ServiceAreaActionState>;
  submitLabel: string;
  area?: {
    id: string;
    label: string;
    primaryPostalCode: string;
    postalCodesText: string;
    city: string;
    state: string;
    deliveryFee: number;
    minimumOrderAmount: number;
    isActive: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const { messages } = useI18n();
  const m = messages.forms.serviceArea;

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {area ? <input type="hidden" name="service_area_id" value={area.id} /> : null}

      <div className="order-card">
        <strong>{title}</strong>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.labelLabel}</div>
            <input name="label" type="text" defaultValue={area?.label ?? ""} placeholder={m.labelPlaceholder} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.primaryPostalCodeLabel}</div>
            <input name="primary_postal_code" type="text" defaultValue={area?.primaryPostalCode ?? ""} placeholder={m.primaryPostalCodePlaceholder} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.cityLabel}</div>
            <input name="city" type="text" defaultValue={area?.city ?? ""} placeholder={m.cityPlaceholder} />
          </label>
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.stateLabel}</div>
            <input name="state" type="text" defaultValue={area?.state ?? ""} placeholder={m.statePlaceholder} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.deliveryFeeLabel}</div>
            <input name="delivery_fee" type="number" step="0.01" min="0" defaultValue={area?.deliveryFee ?? 0} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.minimumOrderLabel}</div>
            <input name="minimum_order_amount" type="number" step="0.01" min="0" defaultValue={area?.minimumOrderAmount ?? 0} />
          </label>
        </div>

        <label style={{ display: "block", marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>{m.postalCodesLabel}</div>
          <textarea
            name="postal_codes"
            rows={3}
            defaultValue={area?.postalCodesText ?? area?.primaryPostalCode ?? ""}
            placeholder={m.postalCodesPlaceholder}
            style={{ width: "100%", fontFamily: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input name="is_active" type="checkbox" defaultChecked={area?.isActive ?? true} />
          <strong>{m.isActiveLabel}</strong>
        </label>
      </div>

      {state.message ? (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : submitLabel}
        </button>
      </div>
    </form>
  );
}

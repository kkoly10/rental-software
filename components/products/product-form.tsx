"use client";

import { useActionState } from "react";
import { createProduct, updateProduct } from "@/lib/products/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function ProductForm({
  product,
  categories,
}: {
  product?: {
    id: string;
    name: string;
    categoryId: string;
    shortDescription: string;
    description: string;
    basePrice: number;
    securityDeposit: number;
    isActive: boolean;
    visibility: string;
    requiresDelivery: boolean;
  } | null;
  categories: { id: string; name: string }[];
}) {
  const isEdit = !!product;
  const action = isEdit ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);
  const { messages } = useI18n();
  const m = messages.forms.editProduct;

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {isEdit && <input type="hidden" name="product_id" value={product!.id} />}

      <label className="order-card">
        <strong>{m.productNameLabel}</strong>
        <input
          name="name"
          type="text"
          defaultValue={product?.name ?? ""}
          placeholder={m.productNamePlaceholder}
          required
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.categoryLabel}</strong>
        <select
          name="category_id"
          defaultValue={product?.categoryId ?? ""}
          style={{ marginTop: 10, width: "100%" }}
        >
          <option value="">{m.categoryPlaceholder}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.basePriceLabel}</strong>
          <input
            name="base_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.basePrice ?? 0}
            placeholder={m.basePricePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{m.securityDepositLabel}</strong>
          <input
            name="security_deposit"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.securityDeposit ?? 0}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{m.visibilityLabel}</strong>
          <select
            name="visibility"
            defaultValue={product?.visibility ?? "public"}
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="public">{m.visibilities.public}</option>
            <option value="unlisted">{m.visibilities.unlisted}</option>
            <option value="hidden">{m.visibilities.hidden}</option>
          </select>
        </label>
      </div>

      <label className="order-card">
        <strong>{m.shortDescriptionLabel}</strong>
        <input
          name="short_description"
          type="text"
          defaultValue={product?.shortDescription ?? ""}
          placeholder={m.shortDescriptionPlaceholder}
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.fullDescriptionLabel}</strong>
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder={m.fullDescriptionPlaceholder}
          rows={4}
          style={{ marginTop: 10, width: "100%", fontFamily: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}
        />
      </label>

      <div className="order-card" style={{ display: "flex", gap: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="requires_delivery"
            type="checkbox"
            defaultChecked={product?.requiresDelivery ?? true}
          />
          <strong>{m.requiresDeliveryLabel}</strong>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={product?.isActive ?? true}
            value="on"
          />
          <strong>{m.activePublishedLabel}</strong>
        </label>
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : isEdit ? m.submitEdit : m.submitCreate}
        </button>
      </div>
    </form>
  );
}

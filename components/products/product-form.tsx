"use client";

import { useActionState } from "react";
import { createProduct, updateProduct } from "@/lib/products/actions";

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

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {isEdit && <input type="hidden" name="product_id" value={product!.id} />}

      <label className="order-card">
        <strong>Product name</strong>
        <input
          name="name"
          type="text"
          defaultValue={product?.name ?? ""}
          placeholder="e.g. Castle Bouncer"
          required
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Category</strong>
        <select
          name="category_id"
          defaultValue={product?.categoryId ?? ""}
          style={{ marginTop: 10, width: "100%" }}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Base price ($/day)</strong>
          <input
            name="base_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.basePrice ?? 0}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Security deposit ($)</strong>
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
          <strong>Visibility</strong>
          <select
            name="visibility"
            defaultValue={product?.visibility ?? "public"}
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>

      <label className="order-card">
        <strong>Short description</strong>
        <input
          name="short_description"
          type="text"
          defaultValue={product?.shortDescription ?? ""}
          placeholder="One-line summary for catalog cards"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Full description</strong>
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="Detailed product info, setup notes, recommended age, etc."
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
          <strong>Requires delivery</strong>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={product?.isActive ?? true}
            value="on"
          />
          <strong>Active / Published</strong>
        </label>
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Product"}
        </button>
      </div>
    </form>
  );
}

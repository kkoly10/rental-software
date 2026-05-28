"use client";

import { useActionState } from "react";
import {
  addProductAsset,
  updateProductAssetStatus,
  removeProductAsset,
  type AssetActionState,
} from "@/lib/products/asset-actions";
import type { ProductAsset } from "@/lib/data/product-assets";

const initialState: AssetActionState = { ok: false, message: "" };

const STATUS_OPTIONS: Array<{ value: string; label: string; bookable: boolean }> = [
  { value: "ready", label: "Ready (bookable)", bookable: true },
  { value: "maintenance", label: "In maintenance", bookable: false },
  { value: "broken", label: "Broken", bookable: false },
  { value: "retired", label: "Retired", bookable: false },
];

function statusBadgeClass(s: string): string {
  if (["ready", "available", "active"].includes(s)) return "badge success";
  if (s === "maintenance") return "badge warning";
  return "badge";
}

export function AssetManager({
  productId,
  assets,
}: {
  productId: string;
  assets: ProductAsset[];
}) {
  const [addState, addAction, addPending] = useActionState(addProductAsset, initialState);
  const bookableCount = assets.filter((a) => a.isAvailable).length;

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="section-header">
        <div>
          <div className="kicker">Inventory</div>
          <h2 style={{ margin: "6px 0 0" }}>Physical units</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Each row is one rentable unit. A product needs at least one unit in
            <strong> Ready</strong> status to accept bookings on the storefront.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className={bookableCount > 0 ? "badge success" : "badge warning"}>
          {bookableCount} of {assets.length} ready for booking
        </span>
        <form action={addAction}>
          <input type="hidden" name="product_id" value={productId} />
          <button type="submit" className="secondary-btn" disabled={addPending} style={{ fontSize: 13, padding: "8px 14px" }}>
            {addPending ? "Adding…" : "+ Add unit"}
          </button>
        </form>
      </div>

      {addState.message && (
        <div
          role={addState.ok ? "status" : "alert"}
          aria-live={addState.ok ? "polite" : "assertive"}
          className={addState.ok ? "badge success" : "badge warning"}
          style={{ marginTop: 12, display: "inline-block" }}
        >
          {addState.message}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="order-card" style={{ marginTop: 12 }}>
          <strong>No units yet.</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            Add at least one unit to make this product bookable.
          </div>
        </div>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {assets.map((asset) => (
            <AssetRow key={asset.id} productId={productId} asset={asset} />
          ))}
        </div>
      )}
    </section>
  );
}

function AssetRow({ productId, asset }: { productId: string; asset: ProductAsset }) {
  const [statusState, statusAction, statusPending] = useActionState(updateProductAssetStatus, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeProductAsset, initialState);

  return (
    <div
      className="order-card"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
    >
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>{asset.assetTag}</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Added {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className={statusBadgeClass(asset.operationalStatus)}>{asset.operationalStatus}</span>

        <form action={statusAction} style={{ display: "inline-flex", gap: 6 }}>
          <input type="hidden" name="asset_id" value={asset.id} />
          <input type="hidden" name="product_id" value={productId} />
          <select
            name="operational_status"
            defaultValue={asset.operationalStatus}
            aria-label={`Status for ${asset.assetTag}`}
            style={{ minHeight: 36, fontSize: 13, borderRadius: 8 }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="submit" className="ghost-btn" disabled={statusPending} style={{ fontSize: 12, padding: "4px 10px" }}>
            {statusPending ? "…" : "Save"}
          </button>
        </form>

        <form
          action={removeAction}
          onSubmit={(e) => {
            if (!confirm(`Remove unit ${asset.assetTag}?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="asset_id" value={asset.id} />
          <input type="hidden" name="product_id" value={productId} />
          <button type="submit" className="ghost-btn" disabled={removePending} style={{ fontSize: 12, padding: "4px 10px", color: "var(--danger, #b91c1c)" }}>
            {removePending ? "…" : "Remove"}
          </button>
        </form>
      </div>

      {(statusState.message || removeState.message) && (
        <div
          role={statusState.ok || removeState.ok ? "status" : "alert"}
          aria-live={statusState.ok || removeState.ok ? "polite" : "assertive"}
          className="muted"
          style={{ width: "100%", fontSize: 12, marginTop: 4 }}
        >
          {statusState.message || removeState.message}
        </div>
      )}
    </div>
  );
}

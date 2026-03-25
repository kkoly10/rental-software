"use client";

import { useActionState } from "react";
import { addProductImage, removeProductImage } from "@/lib/products/actions";

const initialState = { ok: false, message: "" };

export function ProductImageManager({
  productId,
  images,
}: {
  productId: string;
  images: { id: string; url: string; alt: string; isPrimary: boolean }[];
}) {
  const [addState, addAction, addPending] = useActionState(addProductImage, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeProductImage, initialState);

  return (
    <div>
      <div className="list">
        {images.length === 0 && (
          <div className="order-card muted" style={{ textAlign: "center", padding: 16 }}>
            No images yet. Add an image URL below.
          </div>
        )}
        {images.map((img) => (
          <div key={img.id} className="order-card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              className="product-media"
              style={{
                width: 64,
                height: 64,
                minWidth: 64,
                borderRadius: 8,
                backgroundImage: `url(${img.url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, wordBreak: "break-all" }}>{img.url}</div>
              {img.isPrimary && <span className="badge success" style={{ marginTop: 4 }}>Primary</span>}
            </div>
            <form action={removeAction}>
              <input type="hidden" name="image_id" value={img.id} />
              <button type="submit" className="ghost-btn" style={{ color: "var(--danger, #c00)", fontSize: 12 }} disabled={removePending}>
                Remove
              </button>
            </form>
          </div>
        ))}
      </div>

      <form action={addAction} style={{ marginTop: 12 }}>
        <input type="hidden" name="product_id" value={productId} />
        <div className="list">
          <label className="order-card">
            <strong>Image URL</strong>
            <input
              name="image_url"
              type="url"
              placeholder="https://example.com/photo.jpg"
              required
              style={{ marginTop: 8, width: "100%" }}
            />
          </label>
          <div className="order-card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <label style={{ flex: 1 }}>
              <strong>Alt text</strong>
              <input
                name="alt_text"
                type="text"
                placeholder="Describe the image"
                style={{ marginTop: 8, width: "100%" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
              <input name="is_primary" type="checkbox" />
              <strong>Primary</strong>
            </label>
          </div>
        </div>
        <button type="submit" className="secondary-btn" style={{ marginTop: 10 }} disabled={addPending}>
          {addPending ? "Adding..." : "Add Image"}
        </button>
      </form>

      {addState.message && (
        <div className={addState.ok ? "badge success" : "badge warning"} style={{ marginTop: 8, padding: "8px 12px" }}>
          {addState.message}
        </div>
      )}
      {removeState.message && (
        <div className={removeState.ok ? "badge success" : "badge warning"} style={{ marginTop: 8, padding: "8px 12px" }}>
          {removeState.message}
        </div>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { uploadProductImage } from "@/lib/products/image-actions";
import type { ProductImageRecord } from "@/lib/data/product-images";

const initialState = {
  ok: false,
  message: "",
};

export function ProductImageManager({
  productId,
  images,
}: {
  productId: string;
  images: ProductImageRecord[];
}) {
  const [state, formAction, pending] = useActionState(uploadProductImage, initialState);

  return (
    <div className="list">
      <article className="order-card">
        <strong>Upload product image</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Upload a hero image for the public catalog. The first uploaded image becomes the primary image by default.
        </div>

        <form action={formAction} className="list" style={{ marginTop: 14 }}>
          <input type="hidden" name="product_id" value={productId} />

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>Image file</div>
            <input name="image_file" type="file" accept="image/*" />
          </label>

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>Alt text</div>
            <input
              name="alt_text"
              type="text"
              placeholder="Front view of the inflatable setup"
              style={{ width: "100%" }}
            />
          </label>

          {state.message ? (
            <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
              {state.message}
            </div>
          ) : null}

          <div>
            <button className="primary-btn" type="submit" disabled={pending}>
              {pending ? "Uploading..." : "Upload Image"}
            </button>
          </div>
        </form>
      </article>

      <article className="order-card">
        <strong>Current gallery</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Existing images will appear here when available.
        </div>

        {images.length > 0 ? (
          <div className="grid grid-3" style={{ marginTop: 14 }}>
            {images.map((image) => (
              <div key={image.id} className="panel" style={{ padding: 12 }}>
                <div
                  className="product-media"
                  style={{
                    height: 140,
                    borderRadius: 16,
                    backgroundImage: `url(${image.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div style={{ marginTop: 10 }}>
                  <strong>{image.isPrimary ? "Primary image" : "Gallery image"}</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {image.altText || "Product image"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 14 }}>No images uploaded yet.</div>
        )}
      </article>
    </div>
  );
}

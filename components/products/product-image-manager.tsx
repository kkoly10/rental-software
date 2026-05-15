"use client";

import { useActionState } from "react";
import { uploadProductImage } from "@/lib/products/image-actions";
import type { ProductImageRecord } from "@/lib/data/product-images";
import { useI18n } from "@/lib/i18n/provider";

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
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(uploadProductImage, initialState);

  return (
    <div className="list">
      <article className="order-card">
        <strong>{m.productImage.uploadTitle}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          {m.productImage.uploadBody}
        </div>

        <form action={formAction} className="list" style={{ marginTop: 14 }}>
          <input type="hidden" name="product_id" value={productId} />

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.productImage.imageFile}</div>
            <input name="image_file" type="file" accept="image/*" />
          </label>

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>{m.productImage.altText}</div>
            <input
              name="alt_text"
              type="text"
              placeholder={m.productImage.altPlaceholder}
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
              {pending ? m.productImage.uploading : m.productImage.uploadButton}
            </button>
          </div>
        </form>
      </article>

      <article className="order-card">
        <strong>{m.productImage.currentGallery}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          {m.productImage.galleryBody}
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
                  <strong>{image.isPrimary ? m.productImage.primaryImage : m.productImage.galleryImage}</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {image.altText || m.productImage.defaultAlt}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 14 }}>{m.productImage.noImages}</div>
        )}
      </article>
    </div>
  );
}

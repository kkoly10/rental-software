"use client";

import { useActionState } from "react";
import {
  createMarketListing,
  upsertSellerProfile,
  type SellerActionState,
} from "@/lib/market/seller-actions";

const initial: SellerActionState = { ok: false, message: "" };

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-soft)",
  display: "block",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = { width: "100%" };

function Feedback({ state }: { state: SellerActionState }) {
  if (!state.message) return null;
  return (
    <div className="muted" style={{ fontSize: 13, color: state.ok ? "var(--success, #1e7f4f)" : "#b91c1c" }}>
      {state.message}
    </div>
  );
}

export function SellerProfileForm({
  profile,
}: {
  profile: {
    slug: string;
    displayName: string;
    bio: string | null;
    serviceRadiusMiles: number;
    offersDelivery: boolean;
    offersPickup: boolean;
  } | null;
}) {
  const [state, action, pending] = useActionState(upsertSellerProfile, initial);

  return (
    <form
      action={action}
      className="order-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        Your store page {profile ? "" : "— create it before listing"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Store name</label>
          <input
            name="display_name"
            defaultValue={profile?.displayName ?? ""}
            required
            minLength={2}
            maxLength={80}
            placeholder="Capitol Party Rentals"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Store URL (rent.korent.app/store/…)</label>
          <input
            name="slug"
            defaultValue={profile?.slug ?? ""}
            required
            pattern="[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?"
            placeholder="capitol-party-rentals"
            title="Lowercase letters, numbers and dashes"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>About your store</label>
        <textarea name="bio" defaultValue={profile?.bio ?? ""} maxLength={600} rows={3} style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Service radius (miles)</label>
          <input
            type="number"
            name="service_radius_miles"
            min={1}
            max={200}
            defaultValue={profile?.serviceRadiusMiles ?? 15}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
          <label>
            <input type="checkbox" name="offers_delivery" defaultChecked={profile?.offersDelivery ?? true} /> Delivery
          </label>
          <label>
            <input type="checkbox" name="offers_pickup" defaultChecked={profile?.offersPickup ?? true} /> Pickup
          </label>
        </div>
      </div>

      <button type="submit" className="primary-btn" disabled={pending}>
        {pending ? "Saving…" : profile ? "Update store page" : "Create store page"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

type WorldOption = {
  slug: string;
  label: string;
  status: "live" | "smoke_test";
};
type CategoryOption = { worldSlug: string; slug: string; label: string };

export function CreateListingForm({
  worlds,
  categories,
  products,
}: {
  worlds: WorldOption[];
  categories: CategoryOption[];
  products: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createMarketListing, initial);

  return (
    <form
      action={action}
      className="order-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>New listing</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>World</label>
          <select name="world_slug" required defaultValue="hosting-and-events" style={inputStyle}>
            {worlds.map((w) => (
              <option key={w.slug} value={w.slug}>
                {w.label}
                {w.status === "smoke_test" ? " (pre-list)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Category (must match the world)</label>
          <select name="category_slug" required style={inputStyle}>
            {categories.map((c) => (
              <option key={`${c.worldSlug}/${c.slug}`} value={c.slug}>
                {worlds.find((w) => w.slug === c.worldSlug)?.label} — {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Title</label>
        <input
          name="title"
          required
          minLength={4}
          maxLength={140}
          placeholder="20×30 Frame Tent — white, sidewalls included"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea name="description" maxLength={4000} rows={3} style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Daily price ($)</label>
          <input type="number" name="daily_price" required min={1} max={100000} step="0.01" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Replacement value ($)</label>
          <input type="number" name="replacement_value" min={0} max={500000} step="1" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Quantity</label>
          <input type="number" name="quantity" min={1} max={10000} defaultValue={1} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Condition</label>
          <select name="condition" defaultValue="good" style={inputStyle}>
            <option value="new">New</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="worn">Worn</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Year acquired</label>
          <input type="number" name="acquired_year" min={1990} max={2100} placeholder="2025" style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
          <label>
            <input type="checkbox" name="offers_delivery" defaultChecked /> Delivery
          </label>
          <label>
            <input type="checkbox" name="offers_pickup" defaultChecked /> Pickup
          </label>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Link to a catalog product (optional)</label>
        <select name="product_id" defaultValue="" style={inputStyle}>
          <option value="">— none —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="primary-btn" disabled={pending}>
        {pending ? "Creating…" : "Create draft listing"}
      </button>
      <div className="muted" style={{ fontSize: 12 }}>
        The deposit is computed automatically from replacement value, age and
        condition (never more than the item is worth). Listings start as
        drafts — publish when ready.
      </div>
      <Feedback state={state} />
    </form>
  );
}

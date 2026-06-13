"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createMarketListing,
  upsertSellerProfile,
  type SellerActionState,
} from "@/lib/market/seller-actions";
import { suggestPricing } from "@/lib/market/pricing";
import type { ItemCondition, SellerKind } from "@/lib/market/fees";

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
    stateCode: string;
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
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
        <div>
          <label style={labelStyle}>State (for sales tax)</label>
          <select name="state_code" defaultValue={profile?.stateCode ?? "DC"} style={inputStyle}>
            <option value="DC">Washington, DC</option>
            <option value="MD">Maryland</option>
            <option value="VA">Virginia</option>
          </select>
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
type CategoryOption = { worldSlug: string; slug: string; label: string; riskFamilySlug: string };

export function CreateListingForm({
  worlds,
  categories,
  products,
  sellerKind = "marketplace",
}: {
  worlds: WorldOption[];
  categories: CategoryOption[];
  products: Array<{ id: string; name: string }>;
  sellerKind?: SellerKind;
}) {
  const [state, action, pending] = useActionState(createMarketListing, initial);

  // Pricing calculator state (roadmap item 2 / master plan §8).
  // Controlled mirrors of the calculator's input fields — suggestion
  // updates live; "Use suggested" fills the price fields but the
  // seller always stays in control (never auto-set).
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [replacementValue, setReplacementValue] = useState("");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [acquiredYear, setAcquiredYear] = useState("");
  const [dailyPrice, setDailyPrice] = useState("");
  const [weekendPrice, setWeekendPrice] = useState("");
  const [weeklyPrice, setWeeklyPrice] = useState("");

  const suggestion = useMemo(() => {
    const replacement = Number(replacementValue);
    if (!Number.isFinite(replacement) || replacement <= 0) return null;
    const category = categories.find((c) => c.slug === categorySlug);
    if (!category) return null;
    const year = Number(acquiredYear);
    const ageMonths =
      Number.isFinite(year) && year >= 1990
        ? Math.max(0, (new Date().getFullYear() - year) * 12)
        : 24;
    return suggestPricing({
      replacementValueCents: Math.round(replacement * 100),
      ageMonths,
      condition,
      riskFamilySlug: category.riskFamilySlug,
      sellerKind,
    });
  }, [replacementValue, categorySlug, condition, acquiredYear, categories, sellerKind]);

  const dollars = (cents: number) => `$${Math.round(cents / 100)}`;

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
          <select
            name="category_slug"
            required
            style={inputStyle}
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
          >
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

      <div>
        <label style={labelStyle}>Photos — up to 6 (more photos = more bookings; the biggest lever on your quality score)</label>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" multiple style={{ fontSize: 12 }} />
        <div style={{ fontSize: 11, color: "var(--mk-ink-soft)", marginTop: 4 }}>
          The first photo is your cover. Add shots from different angles, plus any labels or wear.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Replacement value ($) — powers price &amp; deposit suggestions</label>
          <input
            type="number"
            name="replacement_value"
            min={0}
            max={500000}
            step="1"
            style={inputStyle}
            value={replacementValue}
            onChange={(e) => setReplacementValue(e.target.value)}
            placeholder="400"
          />
        </div>
        <div>
          <label style={labelStyle}>Quantity</label>
          <input type="number" name="quantity" min={1} max={10000} defaultValue={1} style={inputStyle} />
        </div>
      </div>

      {suggestion ? (
        <div
          className="order-card"
          style={{ padding: 14, background: "#fdf6ec", border: "1px solid #f0e0c8" }}
        >
          {/* Single template literals: the JSX transform was observed
              dropping spaces at expression/text boundaries in the
              deployed bundle ("48rental days"). */}
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {`💡 Items like this typically rent for ${dollars(suggestion.dailyLowCents)}–${dollars(suggestion.dailyPremiumCents)}/day — we suggest ${dollars(suggestion.dailyRecommendedCents)}`}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {`You’d earn ≈${dollars(suggestion.payoutPerDayCents)} per rental day after fees — about ${suggestion.recoverDays} rental days to recover your item’s value. Weekend ${dollars(suggestion.weekendCents)} · weekly ${dollars(suggestion.weeklyCents)}.`}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
            {suggestion.explanation}
          </div>
          <button
            type="button"
            className="secondary-btn"
            style={{ marginTop: 8, fontSize: 12 }}
            onClick={() => {
              setDailyPrice(String(suggestion.dailyRecommendedCents / 100));
              setWeekendPrice(String(suggestion.weekendCents / 100));
              setWeeklyPrice(String(suggestion.weeklyCents / 100));
            }}
          >
            Use suggested prices
          </button>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Daily price ($)</label>
          <input
            type="number"
            name="daily_price"
            required
            min={1}
            max={100000}
            step="0.01"
            style={inputStyle}
            value={dailyPrice}
            onChange={(e) => setDailyPrice(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Weekend price ($, optional)</label>
          <input
            type="number"
            name="weekend_price"
            min={1}
            max={200000}
            step="0.01"
            style={inputStyle}
            value={weekendPrice}
            onChange={(e) => setWeekendPrice(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Weekly price ($, optional)</label>
          <input
            type="number"
            name="weekly_price"
            min={1}
            max={500000}
            step="0.01"
            style={inputStyle}
            value={weeklyPrice}
            onChange={(e) => setWeeklyPrice(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Condition</label>
          <select
            name="condition"
            style={inputStyle}
            value={condition}
            onChange={(e) => setCondition(e.target.value as ItemCondition)}
          >
            <option value="new">New</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="worn">Worn</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Year acquired</label>
          <input
            type="number"
            name="acquired_year"
            min={1990}
            max={2100}
            placeholder="2025"
            style={inputStyle}
            value={acquiredYear}
            onChange={(e) => setAcquiredYear(e.target.value)}
          />
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>
            Proof-of-function video (required for powered/electric items)
          </label>
          <input
            type="file"
            name="proof_video"
            accept="video/mp4,video/quicktime,video/webm"
            style={{ fontSize: 12 }}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Short clip of the item powered on and working — e.g. the blow
            dryer running. Renters see it on the listing.
          </div>
        </div>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" name="instant_book" /> ⚡ Instant book — renters
          can book &amp; pay without waiting for your approval (where the
          category allows it)
        </label>
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

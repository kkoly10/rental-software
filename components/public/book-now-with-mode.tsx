"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart/cart-context";

/**
 * Sprint 6.0 — mode-aware "Book Now" CTA on the storefront product
 * detail page. When the product supports both dry and wet, render a
 * pair of radio cards letting the customer pick before clicking
 * through to checkout (the mode is appended to the checkout URL as
 * ?mode=wet|dry). When the product supports only one mode, render the
 * existing single-button behaviour and the wet price toggle is
 * invisible to the customer.
 *
 * Kept as a client component because the radio state lives in the
 * customer's browser — the server-rendered detail page knows the
 * available modes but doesn't know which one the customer will pick.
 *
 * Pricing display: the dry option shows the base price, the wet
 * option shows base + upcharge formatted in dollars. Falls back to
 * base price for the wet card when the operator left the upcharge
 * blank (which the server-side reconciler also clamps to null), so
 * the customer is never shown a price higher than what we'll charge.
 */
export type BookNowVariant = {
  id: string;
  label: string;
  thumbnailUrl: string | null;
  priceDeltaCents: number;
  isDefault: boolean;
};

export function BookNowWithMode({
  checkoutQuery,
  basePriceCents,
  supportsModes,
  wetUpchargeCents,
  backHref,
  product,
  perUnit,
  variants,
  addOns,
}: {
  checkoutQuery: string;
  basePriceCents: number;
  supportsModes: string[];
  wetUpchargeCents: number | null;
  backHref: string;
  // Snapshot used to add this product to the multi-item cart. Prices here are
  // display-only; the server re-derives money at checkout.
  product: {
    slug: string;
    name: string;
    imageUrl?: string;
    priceLabel: string;
  };
  // Phase 2e.13b — per-unit pricing. Present only when the product
  // carries pricing.per-unit AND has a unit_price_cents configured;
  // null/undefined renders the existing single-button CTA so a
  // dual-mode bouncer with no per-unit fields stays unchanged.
  perUnit?: {
    unitPriceCents: number;
    unitLabel: string;
    minimumQuantity: number;
  } | null;
  // Phase 2e.12 — variant gallery picker. When provided + non-empty,
  // renders an interactive thumbnail grid; the customer's pick is
  // appended as ?variant=<id> on the checkout link so the submit
  // action can validate it + apply price_delta_cents. Omit/empty to
  // skip — products without display.variant-gallery won't pass any.
  variants?: BookNowVariant[];
  // Phase 2e.10 — composition.add-ons selector. Each row renders as
  // a checkbox + quantity input; selected rows append to the checkout
  // query as ?addons=id:qty,id:qty for the submit-time multi-line
  // dispatch in lib/checkout/actions.ts to validate and insert.
  addOns?: Array<{
    addonProductId: string;
    name: string;
    basePriceCents: number;
    defaultQuantity: number;
    maxQuantity: number | null;
    isRequired: boolean;
  }>;
}) {
  const supportsDry = supportsModes.includes("dry");
  const supportsWet = supportsModes.includes("wet");
  const isDualMode = supportsDry && supportsWet;

  // Initial selection: prefer dry when both supported (matches the
  // industry default), otherwise whichever single mode is available.
  const [selectedMode, setSelectedMode] = useState<"dry" | "wet">(
    isDualMode || supportsDry ? "dry" : "wet",
  );

  const { messages: m } = useI18n();
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const labels = m.forms.editProduct.inflatableSetup;
  const cta = m.inventoryDetail.bookNow;
  const back = m.common.back;

  const wetEffectiveCents =
    basePriceCents + (wetUpchargeCents && wetUpchargeCents > 0 ? wetUpchargeCents : 0);
  const dryPrice = formatDollars(basePriceCents);
  const wetPrice = formatDollars(wetEffectiveCents);

  // Phase 2e.13b — units selector state. Starts at the operator's
  // minimum (or 1) so the customer never submits below the minimum
  // by default; tied to a number input below. The submit-time
  // dispatch in lib/checkout/actions.ts clamps + truncates so a
  // crafted ?units=… in the URL can't undercharge.
  const [units, setUnits] = useState<number>(() =>
    perUnit ? Math.max(1, perUnit.minimumQuantity || 1) : 1,
  );

  // Phase 2e.12 — variant selection state. Default to the operator's
  // is_default variant, or the first one if no default flagged. Null
  // when there are no variants (variant picker doesn't render at all).
  const hasVariants = Array.isArray(variants) && variants.length > 0;
  const initialVariantId = hasVariants
    ? (variants!.find((v) => v.isDefault) ?? variants![0]).id
    : null;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    initialVariantId,
  );
  const selectedVariant = hasVariants
    ? variants!.find((v) => v.id === selectedVariantId) ?? null
    : null;

  // Phase 2e.10 — add-on selections state. Initial qty = defaultQuantity
  // for required rows, 0 for optional. The map is keyed by
  // addonProductId so multiple rows stay independent.
  const hasAddons = Array.isArray(addOns) && addOns.length > 0;
  const [addonQty, setAddonQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (hasAddons) {
      for (const a of addOns!) {
        init[a.addonProductId] = a.isRequired ? Math.max(1, a.defaultQuantity) : 0;
      }
    }
    return init;
  });
  const addonsQueryValue = hasAddons
    ? Object.entries(addonQty)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${id}:${Math.trunc(q)}`)
        .join(",")
    : "";
  const addonsSubtotalCents = hasAddons
    ? addOns!.reduce(
        (sum, a) => sum + Math.max(0, Math.trunc(addonQty[a.addonProductId] ?? 0)) * a.basePriceCents,
        0,
      )
    : 0;

  const params = new URLSearchParams(checkoutQuery);
  if (isDualMode) {
    params.set("mode", selectedMode);
  }
  if (perUnit && units > 0) {
    params.set("units", String(Math.trunc(units)));
  }
  if (selectedVariantId) {
    params.set("variant", selectedVariantId);
  }
  if (addonsQueryValue) {
    params.set("addons", addonsQueryValue);
  }
  const checkoutHref = `/checkout?${params.toString()}`;

  // Live per-unit total preview so the customer sees their actual
  // line total before clicking through. Mirrors the per-unit helper
  // math (units × rate / 100).
  const perUnitTotalDollars = perUnit
    ? ((Math.max(0, Math.trunc(units)) * perUnit.unitPriceCents) / 100).toFixed(2)
    : null;

  const belowMinimum =
    perUnit && perUnit.minimumQuantity > 0 && units < perUnit.minimumQuantity;

  function handleAddToCart() {
    addItem({
      slug: product.slug,
      name: product.name,
      imageUrl: product.imageUrl,
      priceLabel: product.priceLabel,
      mode: isDualMode ? selectedMode : undefined,
      units: perUnit ? Math.max(1, Math.trunc(units)) : undefined,
      variantId: selectedVariantId ?? undefined,
      variantLabel: selectedVariant?.label,
      addons: hasAddons
        ? Object.entries(addonQty)
            .filter(([, q]) => q > 0)
            .map(([id, q]) => ({ id, qty: Math.trunc(q) }))
        : undefined,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div className="st-pdp-booking">
      {perUnit && (
        <div className="st-pdp-group">
          <label>
            <span className="st-eyebrow st-pdp-group-label">
              How many {perUnit.unitLabel}s?
            </span>
            <input
              type="number"
              min={perUnit.minimumQuantity || 1}
              step={1}
              value={units}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setUnits(Number.isFinite(n) && n > 0 ? n : 1);
              }}
              className="st-pdp-input"
              aria-describedby="units-help"
            />
            <span id="units-help" className="st-pdp-group-help">
              ${(perUnit.unitPriceCents / 100).toFixed(2)} per {perUnit.unitLabel}
              {perUnit.minimumQuantity > 0 ? (
                <> · {perUnit.minimumQuantity} minimum</>
              ) : null}
            </span>
          </label>
          <div className="st-pdp-subtotal">Subtotal: ${perUnitTotalDollars}</div>
          {belowMinimum && (
            <div className="st-pdp-error" role="alert">
              Minimum order is {perUnit.minimumQuantity} {perUnit.unitLabel}s. Please add more to continue.
            </div>
          )}
        </div>
      )}

      {hasVariants && (
        <div role="radiogroup" aria-label="Options" className="st-pdp-group">
          <span className="st-eyebrow st-pdp-group-label">Options</span>
          <div className="st-pdp-radio-grid">
            {variants!.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              return (
                <button
                  type="button"
                  key={variant.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className="st-pdp-variant"
                >
                  <div
                    className="st-pdp-variant-img"
                    style={
                      variant.thumbnailUrl
                        ? { backgroundImage: `url(${variant.thumbnailUrl})` }
                        : undefined
                    }
                  />
                  <div className="st-pdp-variant-label">
                    <strong>{variant.label}</strong>
                    {variant.priceDeltaCents !== 0 && (
                      <span className="delta">
                        {variant.priceDeltaCents > 0 ? "+" : "−"}$
                        {Math.abs(variant.priceDeltaCents / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedVariant && selectedVariant.priceDeltaCents !== 0 && (
            <span className="st-pdp-group-help">
              Selected: {selectedVariant.label} (
              {selectedVariant.priceDeltaCents > 0 ? "+" : "−"}$
              {Math.abs(selectedVariant.priceDeltaCents / 100).toFixed(2)})
            </span>
          )}
        </div>
      )}

      {hasAddons && (
        <div className="st-pdp-group">
          <span className="st-eyebrow st-pdp-group-label">Add-ons</span>
          <div className="st-pdp-addon-list">
            {addOns!.map((a) => {
              const qty = addonQty[a.addonProductId] ?? 0;
              const checked = qty > 0;
              const cap = a.maxQuantity ?? 99;
              return (
                <div key={a.addonProductId} className="st-pdp-addon">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={a.isRequired}
                    onChange={(e) =>
                      setAddonQty((prev) => ({
                        ...prev,
                        [a.addonProductId]: e.target.checked
                          ? Math.max(1, a.defaultQuantity || 1)
                          : 0,
                      }))
                    }
                    aria-label={a.name}
                  />
                  <div className="st-pdp-addon-body">
                    <div className="st-pdp-addon-name">
                      {a.name}
                      {a.isRequired && <span className="required">required</span>}
                    </div>
                    <div className="st-pdp-addon-price">
                      ${(a.basePriceCents / 100).toFixed(2)} each
                    </div>
                  </div>
                  {checked && (
                    <input
                      type="number"
                      min={1}
                      max={cap}
                      step={1}
                      value={qty}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        const clamped = Number.isFinite(n)
                          ? Math.min(Math.max(1, n), cap)
                          : 1;
                        setAddonQty((prev) => ({
                          ...prev,
                          [a.addonProductId]: clamped,
                        }));
                      }}
                      className="st-pdp-input st-pdp-input-narrow"
                      aria-label={`Quantity for ${a.name}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {addonsSubtotalCents > 0 && (
            <span className="st-pdp-group-help">
              Add-ons subtotal: ${(addonsSubtotalCents / 100).toFixed(2)}
            </span>
          )}
        </div>
      )}

      {isDualMode && (
        <div role="radiogroup" aria-label={labels.availableModesLabel} className="st-pdp-mode-grid">
          <ModeRadio
            value="dry"
            label={labels.dryLabel}
            price={dryPrice}
            selected={selectedMode === "dry"}
            onSelect={() => setSelectedMode("dry")}
          />
          <ModeRadio
            value="wet"
            label={labels.wetLabel}
            price={wetPrice}
            selected={selectedMode === "wet"}
            onSelect={() => setSelectedMode("wet")}
          />
        </div>
      )}

      <div className="st-pdp-cta-row">
        {belowMinimum ? (
          <button
            type="button"
            className="st-pdp-primary"
            disabled
            aria-disabled="true"
          >
            {cta}
          </button>
        ) : (
          <Link href={checkoutHref} className="st-pdp-primary">
            {cta}
          </Link>
        )}
        <button
          type="button"
          className="st-pdp-secondary"
          onClick={handleAddToCart}
          disabled={!!belowMinimum}
          aria-disabled={!!belowMinimum}
        >
          {justAdded ? m.inventoryDetail.addedToCart : m.inventoryDetail.addToCart}
        </button>
        <Link href={backHref} className="st-text-link" style={{ alignSelf: "flex-start" }}>
          ← {back}
        </Link>
      </div>
    </div>
  );
}

function ModeRadio({
  value,
  label,
  price,
  selected,
  onSelect,
}: {
  value: "dry" | "wet";
  label: string;
  price: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="st-pdp-mode">
      <input
        type="radio"
        name="storefront_mode"
        value={value}
        checked={selected}
        onChange={onSelect}
      />
      <strong>{label}</strong>
      <span className="st-pdp-mode-price">{price}</span>
    </label>
  );
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

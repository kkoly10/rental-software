"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

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
  perUnit,
  variants,
  addOns,
}: {
  checkoutQuery: string;
  basePriceCents: number;
  supportsModes: string[];
  wetUpchargeCents: number | null;
  backHref: string;
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

  return (
    <div style={{ marginTop: 20 }}>
      {perUnit && (
        <div
          className="order-card"
          style={{ marginBottom: 16, padding: 16 }}
        >
          <label
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <strong style={{ fontSize: 14 }}>
              How many {perUnit.unitLabel}s?
            </strong>
            <input
              type="number"
              min={perUnit.minimumQuantity || 1}
              step={1}
              value={units}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setUnits(Number.isFinite(n) && n > 0 ? n : 1);
              }}
              style={{
                padding: "8px 10px",
                fontSize: 15,
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 6,
                maxWidth: 160,
              }}
              aria-describedby="units-help"
            />
            <span
              id="units-help"
              className="muted"
              style={{ fontSize: 13 }}
            >
              ${(perUnit.unitPriceCents / 100).toFixed(2)} per{" "}
              {perUnit.unitLabel}
              {perUnit.minimumQuantity > 0 ? (
                <> · {perUnit.minimumQuantity} minimum</>
              ) : null}
            </span>
          </label>
          <div
            style={{
              marginTop: 12,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Subtotal: ${perUnitTotalDollars}
          </div>
          {belowMinimum && (
            <div
              className="field-error"
              role="alert"
              style={{ marginTop: 8, fontSize: 13 }}
            >
              Minimum order is {perUnit.minimumQuantity} {perUnit.unitLabel}
              s. Please add more to continue.
            </div>
          )}
        </div>
      )}

      {hasVariants && (
        <div
          role="radiogroup"
          aria-label="Options"
          className="order-card"
          style={{ marginBottom: 16, padding: 16 }}
        >
          <strong
            style={{
              display: "block",
              fontSize: "0.78rem",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--text-muted, #6b7280)",
              marginBottom: 12,
            }}
          >
            Options
          </strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            {variants!.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              return (
                <button
                  type="button"
                  key={variant.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedVariantId(variant.id)}
                  style={{
                    border: isSelected
                      ? "2px solid var(--primary, #2563eb)"
                      : "1px solid var(--border, #e5e7eb)",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#fff",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                  }}
                >
                  <div
                    style={{
                      backgroundImage: variant.thumbnailUrl
                        ? `url(${variant.thumbnailUrl})`
                        : "linear-gradient(135deg, #f3f4f6, #e5e7eb)",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      aspectRatio: "1 / 1",
                    }}
                  />
                  <div style={{ padding: "8px 10px" }}>
                    <div
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      {variant.label}
                    </div>
                    {variant.priceDeltaCents !== 0 && (
                      <div
                        className="muted"
                        style={{ fontSize: "0.78rem", marginTop: 2 }}
                      >
                        {variant.priceDeltaCents > 0 ? "+" : "−"}$
                        {Math.abs(variant.priceDeltaCents / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedVariant && selectedVariant.priceDeltaCents !== 0 && (
            <div
              className="muted"
              style={{ marginTop: 12, fontSize: "0.82rem" }}
            >
              Selected: {selectedVariant.label} (
              {selectedVariant.priceDeltaCents > 0 ? "+" : "−"}$
              {Math.abs(selectedVariant.priceDeltaCents / 100).toFixed(2)})
            </div>
          )}
        </div>
      )}

      {hasAddons && (
        <div className="order-card" style={{ marginBottom: 16, padding: 16 }}>
          <strong
            style={{
              display: "block",
              fontSize: "0.78rem",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--text-muted, #6b7280)",
              marginBottom: 12,
            }}
          >
            Add-ons
          </strong>
          <div style={{ display: "grid", gap: 8 }}>
            {addOns!.map((a) => {
              const qty = addonQty[a.addonProductId] ?? 0;
              const checked = qty > 0;
              const cap = a.maxQuantity ?? 99;
              return (
                <div
                  key={a.addonProductId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                  }}
                >
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
                  <div style={{ flex: 1, fontSize: 14 }}>
                    <div style={{ fontWeight: 600 }}>
                      {a.name}
                      {a.isRequired && (
                        <span
                          className="muted"
                          style={{ fontWeight: 400, marginLeft: 6, fontSize: 12 }}
                        >
                          required
                        </span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
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
                      style={{
                        width: 60,
                        padding: "4px 8px",
                        border: "1px solid var(--border, #e5e7eb)",
                        borderRadius: 6,
                        fontSize: 14,
                      }}
                      aria-label={`Quantity for ${a.name}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {addonsSubtotalCents > 0 && (
            <div
              className="muted"
              style={{ marginTop: 10, fontSize: "0.82rem" }}
            >
              Add-ons subtotal: ${(addonsSubtotalCents / 100).toFixed(2)}
            </div>
          )}
        </div>
      )}

      {isDualMode && (
        <div
          role="radiogroup"
          aria-label={labels.availableModesLabel}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
            marginBottom: 16,
          }}
        >
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

      <div className="price-row">
        {belowMinimum ? (
          <button
            type="button"
            className="primary-btn"
            disabled
            aria-disabled="true"
            style={{ opacity: 0.5, cursor: "not-allowed" }}
          >
            {cta}
          </button>
        ) : (
          <Link href={checkoutHref} className="primary-btn">
            {cta}
          </Link>
        )}
        <Link href={backHref} className="secondary-btn">
          {back}
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
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 12,
        border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
        margin: selected ? 0 : 1,
        borderRadius: 8,
        cursor: "pointer",
        background: selected ? "var(--primary-bg)" : "transparent",
      }}
    >
      <input
        type="radio"
        name="storefront_mode"
        value={value}
        checked={selected}
        onChange={onSelect}
        style={{ marginBottom: 4 }}
      />
      <strong style={{ fontSize: 14 }}>{label}</strong>
      <span className="muted" style={{ fontSize: 13 }}>
        {price}
      </span>
    </label>
  );
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

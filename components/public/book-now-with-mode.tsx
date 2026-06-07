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
export function BookNowWithMode({
  checkoutQuery,
  basePriceCents,
  supportsModes,
  wetUpchargeCents,
  backHref,
  perUnit,
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

  const params = new URLSearchParams(checkoutQuery);
  if (isDualMode) {
    params.set("mode", selectedMode);
  }
  if (perUnit && units > 0) {
    params.set("units", String(Math.trunc(units)));
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

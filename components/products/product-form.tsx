"use client";

import { useActionState, useState } from "react";
import { createProduct, updateProduct } from "@/lib/products/actions";
import { useI18n } from "@/lib/i18n/provider";
import {
  listCapabilities,
  listCapabilitiesByGroup,
} from "@/lib/capabilities/registry";
import type { CapabilityGroup } from "@/lib/capabilities/types";

const initialState = { ok: false, message: "" };

const ANCHORING_METHOD_KEYS = [
  "stakes",
  "sandbags",
  "water_barrels",
  "concrete_weights",
  "tie_downs",
] as const;

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
    // Sprint 6.0 — inflatable-vertical optional fields.
    supportsModes?: string[];
    wetUpchargeCents?: number | null;
    anchoringMethods?: string[];
    requiredAnchorCount?: number | null;
    // Phase 2e.1 — capability assignment.
    capabilitySlugs?: string[];
    // Phase 2e.3 — per-hour pricing fields.
    hourlyRateCents?: number | null;
    minimumHours?: number | null;
    idleHourRateCents?: number | null;
  } | null;
  categories: { id: string; name: string; vertical: string }[];
}) {
  const isEdit = !!product;
  const action = isEdit ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);
  const { messages } = useI18n();
  const m = messages.forms.editProduct;

  // Track category selection client-side so the inflatable-setup
  // accordion can show/hide as the operator picks a different
  // category without a full page round-trip. Defaults to the saved
  // category in edit mode, empty in create mode.
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    product?.categoryId ?? "",
  );
  const selectedCategoryVertical =
    categories.find((c) => c.id === selectedCategoryId)?.vertical ?? null;
  const showInflatableSetup = selectedCategoryVertical === "inflatable";

  const initialSupportsDry = product?.supportsModes?.includes("dry") ?? true;
  const initialSupportsWet = product?.supportsModes?.includes("wet") ?? false;
  const initialAnchoring = new Set(product?.anchoringMethods ?? []);
  const initialWetUpcharge =
    product?.wetUpchargeCents != null ? product.wetUpchargeCents / 100 : "";
  const initialAnchorCount = product?.requiredAnchorCount ?? "";

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      {isEdit && <input type="hidden" name="product_id" value={product!.id} />}

      <label className="order-card">
        <strong>{m.productNameLabel}</strong>
        <input
          name="name"
          type="text"
          defaultValue={product?.name ?? ""}
          placeholder={m.productNamePlaceholder}
          required
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.categoryLabel}</strong>
        <select
          name="category_id"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          style={{ marginTop: 10, width: "100%" }}
        >
          <option value="">{m.categoryPlaceholder}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>{m.basePriceLabel}</strong>
          <input
            name="base_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.basePrice ?? 0}
            placeholder={m.basePricePlaceholder}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{m.securityDepositLabel}</strong>
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
          <strong>{m.visibilityLabel}</strong>
          <select
            name="visibility"
            defaultValue={product?.visibility ?? "public"}
            style={{ marginTop: 10, width: "100%" }}
          >
            <option value="public">{m.visibilities.public}</option>
            <option value="unlisted">{m.visibilities.unlisted}</option>
            <option value="hidden">{m.visibilities.hidden}</option>
          </select>
        </label>
      </div>

      <label className="order-card">
        <strong>{m.shortDescriptionLabel}</strong>
        <input
          name="short_description"
          type="text"
          defaultValue={product?.shortDescription ?? ""}
          placeholder={m.shortDescriptionPlaceholder}
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.fullDescriptionLabel}</strong>
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder={m.fullDescriptionPlaceholder}
          rows={4}
          style={{ marginTop: 10, width: "100%", fontFamily: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}
        />
      </label>

      {showInflatableSetup && (
        <details className="order-card" open={isEdit && (initialSupportsWet || initialAnchoring.size > 0)}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            {m.inflatableSetup.title}
          </summary>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {m.inflatableSetup.description}
          </div>

          <div style={{ marginTop: 16 }}>
            <strong>{m.inflatableSetup.anchoringMethodsLabel}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {m.inflatableSetup.anchoringMethodsHint}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 6,
                marginTop: 8,
              }}
            >
              {ANCHORING_METHOD_KEYS.map((key) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 8,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    name="anchoring_methods"
                    value={key}
                    defaultChecked={initialAnchoring.has(key)}
                  />
                  {m.inflatableSetup.anchoringMethodLabels[key]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <label>
              <strong>{m.inflatableSetup.requiredAnchorCountLabel}</strong>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {m.inflatableSetup.requiredAnchorCountHint}
              </div>
              <input
                name="required_anchor_count"
                type="number"
                min="0"
                max="64"
                step="1"
                defaultValue={initialAnchorCount}
                style={{ marginTop: 8, width: "100%" }}
              />
            </label>

            <div>
              <strong>{m.inflatableSetup.availableModesLabel}</strong>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {m.inflatableSetup.availableModesHint}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    name="supports_modes"
                    value="dry"
                    defaultChecked={initialSupportsDry}
                  />
                  {m.inflatableSetup.dryLabel}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    name="supports_modes"
                    value="wet"
                    defaultChecked={initialSupportsWet}
                  />
                  {m.inflatableSetup.wetLabel}
                </label>
              </div>
            </div>
          </div>

          <label style={{ display: "block", marginTop: 16 }}>
            <strong>{m.inflatableSetup.wetUpchargeLabel}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {m.inflatableSetup.wetUpchargeHint}
            </div>
            <input
              name="wet_upcharge"
              type="number"
              min="0"
              max="500"
              step="0.01"
              defaultValue={initialWetUpcharge}
              placeholder="50.00"
              style={{ marginTop: 8, width: "100%", maxWidth: 200 }}
            />
          </label>
        </details>
      )}

      <div className="order-card" style={{ display: "flex", gap: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="requires_delivery"
            type="checkbox"
            defaultChecked={product?.requiresDelivery ?? true}
          />
          <strong>{m.requiresDeliveryLabel}</strong>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={product?.isActive ?? true}
            value="on"
          />
          <strong>{m.activePublishedLabel}</strong>
        </label>
      </div>

      {/* Phase 2e.2 — capability assignment. Operator picks which
          capabilities apply to this product; each one will (in 2e.3+)
          render its own form fields conditionally. For now, this
          section sets product.capability_slugs only — the inflatable
          wet/dry + anchoring sections above stay independent until
          the migration to capability-driven fields lands. */}
      <CapabilityCheckboxes initialSlugs={product?.capabilitySlugs ?? []} />

      {/* Phase 2e.3 — per-hour pricing fields. Always present in the
          DOM; the server action ignores them unless the product
          carries the pricing.per-hour capability. A future iteration
          can conditionally render these only when the per-hour
          checkbox is checked client-side. */}
      <PerHourPricingFields
        initialHourlyRateCents={product?.hourlyRateCents ?? null}
        initialMinimumHours={product?.minimumHours ?? null}
        initialIdleHourRateCents={product?.idleHourRateCents ?? null}
      />

      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          aria-live={state.ok ? "polite" : "assertive"}
          className={state.ok ? "badge success" : "badge warning"}
          style={{ padding: "10px 14px" }}
        >
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : isEdit ? m.submitEdit : m.submitCreate}
        </button>
      </div>
    </form>
  );
}

/**
 * Phase 2e.2 — capability assignment UI. Renders checkboxes for every
 * registered capability, grouped by capability group. The selected
 * slugs are posted as the `capability_slugs[]` form group, which the
 * server action's `readCapabilitySlugs` helper filters against the
 * registry one more time before writing to the DB.
 *
 * Display labels are derived from the slug for now (split on `.` and
 * title-case the last segment). An i18n pass can localize these once
 * the marketing content settles.
 */
function CapabilityCheckboxes({ initialSlugs }: { initialSlugs: string[] }) {
  const all = listCapabilities();
  const groups: CapabilityGroup[] = [
    "pricing",
    "mode",
    "setup",
    "display",
    "service",
    "order",
    "composition",
  ];

  const checkedSet = new Set(initialSlugs);

  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Capabilities ({checkedSet.size}/{all.length} selected)
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Choose which features apply to this product. Each capability surfaces
        its own pricing, display, or operational fields elsewhere in the form
        (coming in follow-up releases).
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        {groups.map((group) => {
          const inGroup = listCapabilitiesByGroup(group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group}>
              <strong
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "var(--text-muted, #6b7280)",
                  marginBottom: 8,
                }}
              >
                {group}
              </strong>
              <div style={{ display: "grid", gap: 6 }}>
                {inGroup.map((c) => (
                  <label
                    key={c.slug}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "0.92rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="capability_slugs"
                      value={c.slug}
                      defaultChecked={checkedSet.has(c.slug)}
                    />
                    <span>{slugToLabel(c.slug)}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function slugToLabel(slug: string): string {
  const last = slug.split(".").pop() ?? slug;
  return last
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Phase 2e.3 — per-hour pricing form fields (photo booths, concessions,
 * games, future AV). Posts hourly_rate / minimum_hours / idle_hour_rate
 * as dollar values; the server action's reconcilePerHourCents helper
 * converts to cents AND nulls them out when pricing.per-hour isn't
 * present in the capability_slugs list, so an inactive capability
 * never ghost-bills.
 */
function PerHourPricingFields({
  initialHourlyRateCents,
  initialMinimumHours,
  initialIdleHourRateCents,
}: {
  initialHourlyRateCents: number | null;
  initialMinimumHours: number | null;
  initialIdleHourRateCents: number | null;
}) {
  const hourlyDollars =
    initialHourlyRateCents != null ? initialHourlyRateCents / 100 : "";
  const idleDollars =
    initialIdleHourRateCents != null ? initialIdleHourRateCents / 100 : "";
  const minHours = initialMinimumHours ?? "";

  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Per-hour pricing
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Used when the product carries the <code>pricing.per-hour</code>{" "}
        capability — typically photo booths (3-hour minimum) and concessions
        (1-hour minimum). Leave blank if this product is billed flat-day or
        per-unit.
      </p>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Hourly rate ($)
          </strong>
          <input
            type="number"
            name="hourly_rate"
            min="0"
            max="5000"
            step="0.01"
            defaultValue={hourlyDollars}
            placeholder="200.00"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Minimum hours
          </strong>
          <input
            type="number"
            name="minimum_hours"
            min="0"
            max="24"
            step="1"
            defaultValue={minHours}
            placeholder="3"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Idle-hour rate ($)
          </strong>
          <input
            type="number"
            name="idle_hour_rate"
            min="0"
            max="5000"
            step="0.01"
            defaultValue={idleDollars}
            placeholder="100.00"
            style={{ width: "100%" }}
          />
        </label>
      </div>
      <p
        className="muted"
        style={{ marginTop: 8, fontSize: "0.82rem" }}
      >
        Idle-hour rate is reserved for a future checkout option that lets
        customers price &quot;on-site but inactive&quot; hours (e.g., a photo
        booth present during dinner service) at a discount. Leave blank
        today.
      </p>
    </details>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createProduct, updateProduct } from "@/lib/products/actions";
import { useI18n } from "@/lib/i18n/provider";
import {
  listCapabilities,
  listCapabilitiesByGroup,
} from "@/lib/capabilities/registry";
import type { CapabilityGroup } from "@/lib/capabilities/types";
import { getSuggestedCapabilities } from "@/lib/verticals/suggested-capabilities";

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
    // Phase 2e.4 — per-unit pricing fields.
    unitPriceCents?: number | null;
    unitLabel?: string | null;
    // Phase 2e.5 — setup-window, onsite-attendant, capacity, order-minimum.
    setupMinutesBefore?: number | null;
    breakdownMinutesAfter?: number | null;
    attendantIncludedHours?: number | null;
    attendantOverageCentsPerHour?: number | null;
    capacityMetric?: string | null;
    capacityValue?: number | null;
    minimumOrderQuantity?: number | null;
    damageWaiverRateBps?: number | null;
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
      <CapabilityCheckboxes
        initialSlugs={product?.capabilitySlugs ?? []}
        verticalSlug={selectedCategoryVertical}
        isNewProduct={!product?.id}
      />

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

      {/* Phase 2e.4 — per-unit pricing (tables/chairs/dance floors). */}
      <PerUnitPricingFields
        initialUnitPriceCents={product?.unitPriceCents ?? null}
        initialUnitLabel={product?.unitLabel ?? null}
      />

      {/* Phase 2e.5 — remaining capability field sets. */}
      <SetupWindowField
        initialSetupMinutesBefore={product?.setupMinutesBefore ?? null}
        initialBreakdownMinutesAfter={product?.breakdownMinutesAfter ?? null}
      />
      <OnsiteAttendantFields
        initialIncludedHours={product?.attendantIncludedHours ?? null}
        initialOverageCentsPerHour={
          product?.attendantOverageCentsPerHour ?? null
        }
      />
      <CapacityCalculatorFields
        initialMetric={product?.capacityMetric ?? null}
        initialValue={product?.capacityValue ?? null}
      />
      <OrderMinimumField
        initialMinimumOrderQuantity={product?.minimumOrderQuantity ?? null}
      />
      <DamageWaiverField
        initialDamageWaiverRateBps={product?.damageWaiverRateBps ?? null}
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
function CapabilityCheckboxes({
  initialSlugs,
  verticalSlug,
  isNewProduct,
}: {
  initialSlugs: string[];
  verticalSlug: string | null;
  isNewProduct: boolean;
}) {
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

  // PR-3a — the vertical's registry capability list IS its
  // "suggested by default" set. A new product seeded into a tents
  // category should default to setup-window + damage-waiver +
  // capacity-calc on; a chair product shouldn't even see
  // anchoring/wet-dry without expanding the advanced group. This
  // closes the UX gap the audit flagged: a bouncer operator
  // shouldn't be presented with damage-waiver fields they don't
  // understand, even though the schema permits them.
  const suggestedSet = new Set(
    verticalSlug ? getSuggestedCapabilities(verticalSlug) : []
  );

  // On a NEW product the suggested set is the default-checked set;
  // on EDIT the operator's saved slugs win.
  const checkedSet = new Set(
    isNewProduct && initialSlugs.length === 0 ? [...suggestedSet] : initialSlugs
  );

  return (
    <details className="order-card" style={{ padding: 16 }} open>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Capabilities ({checkedSet.size}/{all.length} selected)
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Choose which features apply to this product. Each capability surfaces
        its own pricing, display, or operational fields elsewhere in the form.
        {verticalSlug && suggestedSet.size > 0 && (
          <>
            {" "}
            We've pre-selected the features <strong>{verticalSlug}</strong>{" "}
            operators typically use; tap <em>Show advanced</em> for the rest.
          </>
        )}
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        {groups.map((group) => {
          const inGroup = listCapabilitiesByGroup(group);
          if (inGroup.length === 0) return null;
          const groupSuggested = inGroup.filter((c) => suggestedSet.has(c.slug));
          const groupAdvanced = inGroup.filter((c) => !suggestedSet.has(c.slug));
          // No vertical → no split; render the old flat list.
          const renderRow = (c: { slug: string }) => (
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
          );
          if (suggestedSet.size === 0) {
            return (
              <div key={group}>
                <CapabilityGroupHeader label={group} />
                <div style={{ display: "grid", gap: 6 }}>
                  {inGroup.map(renderRow)}
                </div>
              </div>
            );
          }
          return (
            <div key={group}>
              <CapabilityGroupHeader label={group} />
              {groupSuggested.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                  {groupSuggested.map(renderRow)}
                </div>
              )}
              {groupAdvanced.length > 0 && (
                <details style={{ marginTop: groupSuggested.length > 0 ? 8 : 0 }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      color: "var(--text-muted, #6b7280)",
                    }}
                  >
                    Show advanced ({groupAdvanced.length})
                  </summary>
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {groupAdvanced.map(renderRow)}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function CapabilityGroupHeader({ label }: { label: string }) {
  return (
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
      {label}
    </strong>
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

/**
 * Phase 2e.4 — per-unit pricing form fields (tables/chairs/dance
 * floors). Same gating pattern as per-hour: the section is always
 * present in the DOM, the server action nulls out the columns when
 * pricing.per-unit isn't in the capability_slugs.
 */
function PerUnitPricingFields({
  initialUnitPriceCents,
  initialUnitLabel,
}: {
  initialUnitPriceCents: number | null;
  initialUnitLabel: string | null;
}) {
  const unitDollars =
    initialUnitPriceCents != null ? initialUnitPriceCents / 100 : "";

  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Per-unit pricing
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Used when the product carries the <code>pricing.per-unit</code>{" "}
        capability — typically chairs (&quot;$5 per chair&quot;), banquet
        tables, and dance-floor sections. The storefront shows the math as
        &quot;$5 per chair × 100 = $500&quot;.
      </p>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Unit price ($)
          </strong>
          <input
            type="number"
            name="unit_price"
            min="0"
            max="5000"
            step="0.01"
            defaultValue={unitDollars}
            placeholder="5.00"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Unit label
          </strong>
          <input
            type="text"
            name="unit_label"
            maxLength={32}
            defaultValue={initialUnitLabel ?? ""}
            placeholder="chair"
            style={{ width: "100%" }}
          />
        </label>
      </div>
    </details>
  );
}

/**
 * Phase 2e.5 — setup window: minutes before event start the crew
 * should arrive. Used by tents (2-4h), dance floors (1-2h),
 * photo booths (~60min). Pull sheet renders arrival = event_start −
 * this value.
 */
function SetupWindowField({
  initialSetupMinutesBefore,
  initialBreakdownMinutesAfter,
}: {
  initialSetupMinutesBefore: number | null;
  initialBreakdownMinutesAfter: number | null;
}) {
  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Setup &amp; breakdown window
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Pull sheet shows arrival = event start − setup minutes. The
        availability check also extends each booking by these buffers
        on both sides so a Saturday tent with 4h setup blocks Friday
        evening for the crew + inventory.
        Tents typically 120-240 setup / 60-120 breakdown; dance floors
        60-120 / 60; photo booths 60 / 30.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Minutes before event start
          </strong>
          <input
            type="number"
            name="setup_minutes_before"
            min="0"
            max="1440"
            step="15"
            defaultValue={initialSetupMinutesBefore ?? ""}
            placeholder="60"
            style={{ width: 220 }}
          />
        </label>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Minutes after event end
          </strong>
          <input
            type="number"
            name="breakdown_minutes_after"
            min="0"
            max="1440"
            step="15"
            defaultValue={initialBreakdownMinutesAfter ?? ""}
            placeholder="60"
            style={{ width: 220 }}
          />
        </label>
      </div>
    </details>
  );
}

/**
 * Phase 2e.5 — onsite-attendant: included hours + overage rate.
 * Used by photo booths (attendant typically included full rental)
 * and concessions (1 hour included, +$100/hr after).
 */
function OnsiteAttendantFields({
  initialIncludedHours,
  initialOverageCentsPerHour,
}: {
  initialIncludedHours: number | null;
  initialOverageCentsPerHour: number | null;
}) {
  const overageDollars =
    initialOverageCentsPerHour != null ? initialOverageCentsPerHour / 100 : "";
  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Onsite attendant
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Used when the product carries the{" "}
        <code>service.onsite-attendant</code> capability. Included hours
        are bundled into the base price; overage bills at the per-hour rate
        below.
      </p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Included hours
          </strong>
          <input
            type="number"
            name="attendant_included_hours"
            min="0"
            max="24"
            step="1"
            defaultValue={initialIncludedHours ?? ""}
            placeholder="1"
            style={{ width: "100%" }}
          />
        </label>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Overage rate ($/hr)
          </strong>
          <input
            type="number"
            name="attendant_overage_rate"
            min="0"
            max="5000"
            step="0.01"
            defaultValue={overageDollars}
            placeholder="100.00"
            style={{ width: "100%" }}
          />
        </label>
      </div>
    </details>
  );
}

/**
 * Phase 2e.5 — capacity calculator: metric + value. Storefront PDP
 * uses these for tent "fits N guests" and dance floor "fits N
 * dancers" recommendations.
 */
function CapacityCalculatorFields({
  initialMetric,
  initialValue,
}: {
  initialMetric: string | null;
  initialValue: number | null;
}) {
  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Capacity
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Used when the product carries the{" "}
        <code>display.capacity-calculator</code> capability.
      </p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Metric
          </strong>
          <select
            name="capacity_metric"
            defaultValue={initialMetric ?? ""}
            style={{ width: "100%" }}
          >
            <option value="">—</option>
            <option value="guests">Guests</option>
            <option value="sq_ft">Square feet</option>
            <option value="dancers">Dancers</option>
            <option value="servings">Servings</option>
          </select>
        </label>
        <label>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Value
          </strong>
          <input
            type="number"
            name="capacity_value"
            min="0"
            max="100000"
            step="1"
            defaultValue={initialValue ?? ""}
            placeholder="100"
            style={{ width: "100%" }}
          />
        </label>
      </div>
    </details>
  );
}

/**
 * Phase 2e.5 — order minimum: product-level quantity floor. Used by
 * tables/chairs ("50-chair minimum per pack").
 */
function OrderMinimumField({
  initialMinimumOrderQuantity,
}: {
  initialMinimumOrderQuantity: number | null;
}) {
  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Order minimum
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Used when the product carries the <code>order.minimum-order</code>{" "}
        capability. Storefront blocks add-to-cart below this quantity with a
        friendly &quot;minimum N units&quot; message.
      </p>
      <label>
        <strong style={{ display: "block", marginBottom: 6 }}>
          Minimum quantity per order
        </strong>
        <input
          type="number"
          name="minimum_order_quantity"
          min="0"
          max="100000"
          step="1"
          defaultValue={initialMinimumOrderQuantity ?? ""}
          placeholder="50"
          style={{ width: 220 }}
        />
      </label>
    </details>
  );
}

/**
 * PR-2c — optional damage waiver (per-product opt-in surcharge).
 * Stored as basis points on the product so cents round predictably.
 * Operator inputs a percentage; we convert on save.
 */
function DamageWaiverField({
  initialDamageWaiverRateBps,
}: {
  initialDamageWaiverRateBps: number | null;
}) {
  const initialPct =
    initialDamageWaiverRateBps !== null
      ? (initialDamageWaiverRateBps / 100).toString()
      : "";
  return (
    <details className="order-card" style={{ padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Damage waiver
      </summary>
      <p
        className="muted"
        style={{ marginTop: 8, marginBottom: 16, fontSize: "0.88rem" }}
      >
        Optional surcharge customers can opt into at checkout to cap their
        liability for accidental damage. Industry standard is 8–12% of the
        rental subtotal. Leave blank to not offer it.
      </p>
      <label>
        <strong style={{ display: "block", marginBottom: 6 }}>
          Waiver rate (%)
        </strong>
        <input
          type="number"
          name="damage_waiver_rate_pct"
          min="0"
          max="50"
          step="0.25"
          defaultValue={initialPct}
          placeholder="10"
          style={{ width: 220 }}
        />
      </label>
    </details>
  );
}

"use client";

import type { PricingRule, PricingRuleType } from "@/lib/pricing/types";

const RULE_TYPE_LABELS: Record<PricingRuleType, string> = {
  weekend: "Weekend",
  holiday: "Holiday",
  peak_season: "Peak Season",
  early_bird: "Early Bird",
  last_minute: "Last Minute",
  multi_day: "Multi-Day",
  bundle: "Bundle",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PricingRuleForm({
  rule,
  onChange,
  onDelete,
}: {
  rule: PricingRule;
  onChange: (updated: PricingRule) => void;
  onDelete: () => void;
}) {
  function update(partial: Partial<PricingRule>) {
    onChange({ ...rule, ...partial });
  }

  function updateConditions(partial: Partial<PricingRule["conditions"]>) {
    onChange({ ...rule, conditions: { ...rule.conditions, ...partial } });
  }

  return (
    <div className="pricing-rule-form">
      <div className="grid grid-3" style={{ gap: 12 }}>
        <label>
          <strong>Name</strong>
          <input
            type="text"
            value={rule.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Rule name"
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>

        <label>
          <strong>Type</strong>
          <select
            value={rule.type}
            onChange={(e) => {
              const type = e.target.value as PricingRuleType;
              update({ type, conditions: getDefaultConditions(type) });
            }}
            style={{ marginTop: 6, width: "100%" }}
          >
            {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <strong>Adjustment %</strong>
          <input
            type="number"
            value={rule.adjustment}
            onChange={(e) => update({ adjustment: Number(e.target.value) })}
            step="1"
            style={{ marginTop: 6, width: "100%" }}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            Positive = surcharge, negative = discount
          </span>
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        {rule.type === "weekend" && (
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <strong>Days of week</strong>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {DAY_LABELS.map((label, i) => (
                <label
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}
                >
                  <input
                    type="checkbox"
                    checked={(rule.conditions.daysOfWeek ?? [0, 6]).includes(i)}
                    onChange={(e) => {
                      const current = rule.conditions.daysOfWeek ?? [0, 6];
                      const next = e.target.checked
                        ? [...current, i]
                        : current.filter((d) => d !== i);
                      updateConditions({ daysOfWeek: next });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {(rule.type === "holiday" || rule.type === "peak_season") && (
          <div>
            <strong>Date ranges</strong>
            {(rule.conditions.dateRanges ?? []).map((range, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                <input
                  type="date"
                  value={range.start}
                  onChange={(e) => {
                    const ranges = [...(rule.conditions.dateRanges ?? [])];
                    ranges[idx] = { ...ranges[idx], start: e.target.value };
                    updateConditions({ dateRanges: ranges });
                  }}
                />
                <span>to</span>
                <input
                  type="date"
                  value={range.end}
                  onChange={(e) => {
                    const ranges = [...(rule.conditions.dateRanges ?? [])];
                    ranges[idx] = { ...ranges[idx], end: e.target.value };
                    updateConditions({ dateRanges: ranges });
                  }}
                />
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    const ranges = (rule.conditions.dateRanges ?? []).filter(
                      (_, i) => i !== idx
                    );
                    updateConditions({ dateRanges: ranges });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="small-btn"
              style={{ marginTop: 8 }}
              onClick={() => {
                const ranges = [...(rule.conditions.dateRanges ?? []), { start: "", end: "" }];
                updateConditions({ dateRanges: ranges });
              }}
            >
              + Add date range
            </button>
          </div>
        )}

        {rule.type === "early_bird" && (
          <label>
            <strong>Minimum days before event</strong>
            <input
              type="number"
              value={rule.conditions.daysBeforeEvent?.min ?? 14}
              min={1}
              onChange={(e) =>
                updateConditions({
                  daysBeforeEvent: {
                    ...rule.conditions.daysBeforeEvent,
                    min: Number(e.target.value),
                  },
                })
              }
              style={{ marginTop: 6, width: 120 }}
            />
          </label>
        )}

        {rule.type === "last_minute" && (
          <label>
            <strong>Maximum days before event</strong>
            <input
              type="number"
              value={rule.conditions.daysBeforeEvent?.max ?? 3}
              min={0}
              onChange={(e) =>
                updateConditions({
                  daysBeforeEvent: {
                    ...rule.conditions.daysBeforeEvent,
                    max: Number(e.target.value),
                  },
                })
              }
              style={{ marginTop: 6, width: 120 }}
            />
          </label>
        )}

        {rule.type === "multi_day" && (
          <label>
            <strong>Minimum rental days</strong>
            <input
              type="number"
              value={rule.conditions.minRentalDays ?? 3}
              min={2}
              onChange={(e) =>
                updateConditions({ minRentalDays: Number(e.target.value) })
              }
              style={{ marginTop: 6, width: 120 }}
            />
          </label>
        )}

        {rule.type === "bundle" && (
          <div className="muted" style={{ fontSize: 13 }}>
            Product-specific bundles will be configurable in a future update.
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={rule.isActive}
            onChange={(e) => update({ isActive: e.target.checked })}
          />
          Active
        </label>

        <button type="button" className="small-btn danger" onClick={onDelete}>
          Delete rule
        </button>
      </div>
    </div>
  );
}

function getDefaultConditions(type: PricingRuleType): PricingRule["conditions"] {
  switch (type) {
    case "weekend":
      return { daysOfWeek: [0, 6] };
    case "holiday":
    case "peak_season":
      return { dateRanges: [{ start: "", end: "" }] };
    case "early_bird":
      return { daysBeforeEvent: { min: 14 } };
    case "last_minute":
      return { daysBeforeEvent: { max: 3 } };
    case "multi_day":
      return { minRentalDays: 3 };
    case "bundle":
      return { productIds: [] };
    default:
      return {};
  }
}

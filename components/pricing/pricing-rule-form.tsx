"use client";

import type { PricingRule, PricingRuleType } from "@/lib/pricing/types";
import { useI18n } from "@/lib/i18n/provider";

export function PricingRuleForm({
  rule,
  onChange,
  onDelete,
}: {
  rule: PricingRule;
  onChange: (updated: PricingRule) => void;
  onDelete: () => void;
}) {
  const { messages } = useI18n();
  const m = messages.forms.pricingRule;

  const RULE_TYPE_LABELS: Record<PricingRuleType, string> = {
    weekend: m.types.weekend,
    holiday: m.types.holiday,
    peak_season: m.types.peakSeason,
    early_bird: m.types.earlyBird,
    last_minute: m.types.lastMinute,
    multi_day: m.types.multiDay,
    bundle: m.types.bundle,
  };

  const DAY_LABELS = [
    m.dayLabels.sun,
    m.dayLabels.mon,
    m.dayLabels.tue,
    m.dayLabels.wed,
    m.dayLabels.thu,
    m.dayLabels.fri,
    m.dayLabels.sat,
  ];

  function update(partial: Partial<PricingRule>) {
    onChange({ ...rule, ...partial });
  }

  function updateConditions(partial: Partial<PricingRule["conditions"]>) {
    onChange({ ...rule, conditions: { ...rule.conditions, ...partial } });
  }

  return (
    <div className="pricing-rule-form">
      <div className="grid grid-3" style={{ gap: 12 }}>
        <label className="field-stack">
          <strong>{m.nameLabel}</strong>
          <input
            type="text"
            value={rule.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={m.namePlaceholder}
            style={{ width: "100%" }}
          />
        </label>

        <label className="field-stack">
          <strong>{m.typeLabel}</strong>
          <select
            value={rule.type}
            onChange={(e) => {
              const type = e.target.value as PricingRuleType;
              update({ type, conditions: getDefaultConditions(type) });
            }}
            style={{ width: "100%" }}
          >
            {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <strong>{m.adjustmentLabel}</strong>
          <input
            type="number"
            value={rule.adjustment}
            onChange={(e) => update({ adjustment: Number(e.target.value) })}
            step="1"
            style={{ width: "100%" }}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            {m.adjustmentHelp}
          </span>
        </label>
      </div>

      <div className="stack-gap-xs">
        {rule.type === "weekend" && (
          <fieldset className="field-stack" style={{ border: "none", padding: 0, margin: 0 }}>
            <strong>{m.daysOfWeekLabel}</strong>
            <div className="grid grid-4" style={{ gap: 10 }}>
              {DAY_LABELS.map((label, i) => (
                <label
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}
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
          <div className="field-stack">
            <strong>{m.dateRangesLabel}</strong>
            {(rule.conditions.dateRanges ?? []).map((range, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 6,
                  alignItems: "center",
                }}
              >
                <input
                  type="date"
                  value={range.start}
                  onChange={(e) => {
                    const ranges = [...(rule.conditions.dateRanges ?? [])];
                    ranges[idx] = { ...ranges[idx], start: e.target.value };
                    updateConditions({ dateRanges: ranges });
                  }}
                  style={{ flex: "1 1 160px" }}
                />
                <span className="muted" style={{ fontSize: 13 }}>
                  {m.dateRangeTo}
                </span>
                <input
                  type="date"
                  value={range.end}
                  onChange={(e) => {
                    const ranges = [...(rule.conditions.dateRanges ?? [])];
                    ranges[idx] = { ...ranges[idx], end: e.target.value };
                    updateConditions({ dateRanges: ranges });
                  }}
                  style={{ flex: "1 1 160px" }}
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
                  {m.removeDateRange}
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
              {m.addDateRange}
            </button>
          </div>
        )}

        {rule.type === "early_bird" && (
          <label className="field-stack" style={{ maxWidth: 180 }}>
            <strong>{m.earlyBirdMinDaysLabel}</strong>
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
              style={{ width: "100%" }}
            />
          </label>
        )}

        {rule.type === "last_minute" && (
          <label className="field-stack" style={{ maxWidth: 180 }}>
            <strong>{m.lastMinuteMaxDaysLabel}</strong>
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
              style={{ width: "100%" }}
            />
          </label>
        )}

        {rule.type === "multi_day" && (
          <label className="field-stack" style={{ maxWidth: 180 }}>
            <strong>{m.minRentalDaysLabel}</strong>
            <input
              type="number"
              value={rule.conditions.minRentalDays ?? 3}
              min={2}
              onChange={(e) =>
                updateConditions({ minRentalDays: Number(e.target.value) })
              }
              style={{ width: "100%" }}
            />
          </label>
        )}

        {rule.type === "bundle" && (
          <div className="muted" style={{ fontSize: 13 }}>
            {m.bundleMessage}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={rule.isActive}
            onChange={(e) => update({ isActive: e.target.checked })}
          />
          {m.activeLabel}
        </label>

        <button type="button" className="small-btn danger" onClick={onDelete}>
          {m.deleteRule}
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

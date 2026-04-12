"use client";

import { useActionState, useState } from "react";
import { savePricingRules } from "@/lib/pricing/actions";
import type { PricingRule } from "@/lib/pricing/types";
import { PricingRuleForm } from "./pricing-rule-form";

const initialState = { ok: false, message: "" };

export function PricingRulesManager({
  initialRules,
}: {
  initialRules: PricingRule[];
}) {
  const [rules, setRules] = useState<PricingRule[]>(initialRules);
  const [state, formAction, pending] = useActionState(savePricingRules, initialState);

  function addRule() {
    const newRule: PricingRule = {
      id: `rule-${Date.now()}`,
      name: "",
      type: "weekend",
      adjustment: 0,
      conditions: { daysOfWeek: [0, 6] },
      isActive: true,
      priority: rules.length,
    };
    setRules([...rules, newRule]);
  }

  function updateRule(index: number, updated: PricingRule) {
    const next = [...rules];
    next[index] = updated;
    setRules(next);
  }

  function deleteRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="kicker">Configuration</div>
          <h2 className="page-title-sm">Pricing Rules</h2>
        </div>
        <button type="button" className="primary-btn" onClick={addRule}>
          + Add Rule
        </button>
      </div>

      <form action={formAction}>
        <input type="hidden" name="rules_json" value={JSON.stringify(rules)} />

        {rules.length === 0 ? (
          <div className="muted" style={{ padding: 20, textAlign: "center" }}>
            No pricing rules yet. Click &quot;+ Add Rule&quot; to create one.
          </div>
        ) : (
          <div className="list">
            {rules.map((rule, index) => (
              <div key={rule.id} className="pricing-rule-card">
                <div className="pricing-rule-card-header" style={{ flexWrap: "wrap", gap: 8 }}>
                  <strong>{rule.name || "Untitled Rule"}</strong>
                  <span
                    className={
                      rule.adjustment >= 0
                        ? "pricing-adjustment positive"
                        : "pricing-adjustment negative"
                    }
                  >
                    {rule.adjustment >= 0 ? "+" : ""}
                    {rule.adjustment}%
                  </span>
                </div>
                <PricingRuleForm
                  rule={rule}
                  onChange={(updated) => updateRule(index, updated)}
                  onDelete={() => deleteRule(index)}
                />
              </div>
            ))}
          </div>
        )}

        {state.message && (
          <div
            className={state.ok ? "badge success" : "badge warning"}
            style={{ padding: "10px 14px", marginTop: 12 }}
          >
            {state.message}
          </div>
        )}

        <div className="action-row-end">
          <button className="primary-btn" type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save All Rules"}
          </button>
        </div>
      </form>
    </section>
  );
}

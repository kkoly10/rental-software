"use client";

import { useActionState, useState } from "react";
import {
  saveDocumentTemplate,
  resetDocumentTemplate,
  type TemplateActionState,
} from "@/lib/documents/template-actions";

const initial: TemplateActionState = { ok: false, message: "" };

export function DocumentTemplateEditor({
  documentType,
  title,
  initialClauses,
  isCustom,
}: {
  documentType: "rental_agreement" | "safety_waiver";
  title: string;
  initialClauses: string[];
  /** True when the operator has saved a custom override (vs. built-in defaults). */
  isCustom: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveDocumentTemplate, initial);
  const [clauses, setClauses] = useState<string[]>(
    initialClauses.length > 0 ? initialClauses : [""],
  );

  const updateClause = (i: number, v: string) =>
    setClauses((cs) => cs.map((c, idx) => (idx === i ? v : c)));
  const removeClause = (i: number) => setClauses((cs) => cs.filter((_, idx) => idx !== i));
  const addClause = () => setClauses((cs) => [...cs, ""]);

  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="section-header">
        <div>
          <div className="kicker">Document</div>
          <h2 style={{ margin: "6px 0 0" }}>
            {title}{" "}
            <span
              className={`badge ${isCustom ? "success" : ""}`}
              style={{ fontSize: 11, marginLeft: 6, verticalAlign: "middle" }}
            >
              {isCustom ? "Customized" : "Default terms"}
            </span>
          </h2>
        </div>
      </div>

      <form action={formAction} className="list" style={{ marginTop: 12 }}>
        <input type="hidden" name="document_type" value={documentType} />
        {clauses.map((clause, i) => (
          <div key={i} className="order-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <strong style={{ fontSize: 13 }}>Clause {i + 1}</strong>
              <button
                type="button"
                className="ghost-btn"
                style={{ fontSize: 12 }}
                onClick={() => removeClause(i)}
                disabled={clauses.length === 1}
              >
                Remove
              </button>
            </div>
            <textarea
              name="clause"
              value={clause}
              onChange={(e) => updateClause(i, e.target.value)}
              rows={4}
              maxLength={4000}
              style={{ width: "100%" }}
              placeholder="e.g. 1. RENTAL PERIOD & RETURN: …"
            />
          </div>
        ))}

        <div>
          <button type="button" className="secondary-btn" onClick={addClause}>
            + Add clause
          </button>
        </div>

        {state.message && (
          <div
            className={`badge ${state.ok ? "success" : "warning"}`}
            role={state.ok ? "status" : "alert"}
            style={{ padding: "10px 14px" }}
          >
            {state.message}
          </div>
        )}

        <div>
          <button className="primary-btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {isCustom && (
        <form action={resetDocumentTemplate} style={{ marginTop: 12 }}>
          <input type="hidden" name="document_type" value={documentType} />
          <button type="submit" className="ghost-btn" style={{ fontSize: 13 }}>
            Reset to built-in default
          </button>
        </form>
      )}
    </section>
  );
}

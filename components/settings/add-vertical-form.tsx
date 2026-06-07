"use client";

import { useActionState } from "react";
import { addOrgVertical, type AddVerticalState } from "@/lib/verticals/actions";

/**
 * Phase 4e — add-vertical form for the settings page.
 *
 * Receives the list of slugs the org has NOT yet declared (computed
 * server-side by subtracting listOrgVerticalSlugs() from the registry).
 * Renders a small select + submit row that posts to the addOrgVertical
 * action (#295). Hidden when remainingSlugs is empty so an org that
 * already declares every registry vertical doesn't see a no-op picker.
 *
 * Keeps state minimal — the action revalidates /dashboard/settings on
 * success so the parent's verticals card re-renders with the new chip.
 */

const initialState: AddVerticalState = { ok: false, message: "" };

export function AddVerticalForm({
  remainingSlugs,
}: {
  remainingSlugs: string[];
}) {
  const [state, formAction, pending] = useActionState(
    addOrgVertical,
    initialState,
  );

  if (remainingSlugs.length === 0) return null;

  return (
    <form action={formAction} style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label htmlFor="add-vertical-select" className="muted" style={{ fontSize: 12 }}>
          Add another:
        </label>
        <select
          id="add-vertical-select"
          name="vertical_slug"
          required
          style={{
            padding: "4px 8px",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 6,
            fontSize: 13,
            background: "#fff",
          }}
        >
          <option value="">Pick a vertical…</option>
          {remainingSlugs.map((slug) => (
            <option key={slug} value={slug}>
              {slug.replace(/-/g, " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="secondary-btn"
          disabled={pending}
          style={{ fontSize: 13, padding: "4px 12px" }}
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "muted" : "field-error"}
          style={{ marginTop: 6, fontSize: 12 }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}

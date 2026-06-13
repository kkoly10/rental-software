"use client";

import { useActionState, useState } from "react";
import { submitDemandRequest, type DemandRequestState } from "@/lib/market/actions";

const initial: DemandRequestState = { ok: false, message: "" };

/**
 * Phase 2 demand capture. Shown on no-results search, coming-soon
 * categories, and the homepage "Can't find it?" CTA. Compact by
 * default (query + email); the rest expands so we never block the
 * submit behind a long form (the noob-first rule).
 */
export function DemandRequestForm({
  sourcePage,
  worldSlug = "",
  categorySlug = "",
  metroSlug,
  defaultQuery = "",
  heading = "Can't find what you need?",
  blurb = "Tell us what you're after and we'll email you the moment a local seller lists it.",
}: {
  sourcePage: string;
  worldSlug?: string;
  categorySlug?: string;
  metroSlug: string;
  defaultQuery?: string;
  heading?: string;
  blurb?: string;
}) {
  const [state, action, pending] = useActionState(submitDemandRequest, initial);
  const [showMore, setShowMore] = useState(false);

  if (state.ok) {
    return (
      <div className="mk-panel" style={{ background: "#f0f9f2" }}>
        <p className="mk-msg ok" style={{ margin: 0 }}>✓ {state.message}</p>
      </div>
    );
  }

  const field: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    border: "1px solid var(--mk-line)",
    borderRadius: 10,
    font: "inherit",
    fontSize: 13,
  };

  return (
    <div className="mk-panel">
      <b style={{ fontSize: 15 }}>{heading}</b>
      <p className="mk-sub" style={{ margin: "6px 0 12px" }}>{blurb}</p>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="hidden" name="source_page" value={sourcePage} />
        <input type="hidden" name="world_slug" value={worldSlug} />
        <input type="hidden" name="category_slug" value={categorySlug} />
        <input type="hidden" name="metro_slug" value={metroSlug} />
        <input
          type="text"
          name="query"
          required
          maxLength={300}
          defaultValue={defaultQuery}
          placeholder="What are you looking for? (e.g. 20x30 tent, wedding photographer, DJ rig)"
          style={field}
        />
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com — where we'll reach you"
          style={field}
        />

        {showMore ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700 }}>
              Need it from
              <input type="date" name="needed_start_date" style={field} />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700 }}>
              …until
              <input type="date" name="needed_end_date" style={field} />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700 }}>
              ZIP code
              <input type="text" name="zip_code" maxLength={12} placeholder="20001" style={field} />
            </label>
            <label style={{ fontSize: 11, fontWeight: 700 }}>
              Budget ($, optional)
              <input type="number" name="budget" min={0} step={1} placeholder="150" style={field} />
            </label>
            <label style={{ fontSize: 12, gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="delivery_required" /> I&rsquo;d need it delivered
            </label>
            <textarea
              name="notes"
              maxLength={2000}
              rows={2}
              placeholder="Anything else? (size, brand, event type…)"
              style={{ ...field, gridColumn: "1 / -1" }}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="mk-btn" disabled={pending}>
            {pending ? "Sending…" : "Notify me"}
          </button>
          {!showMore ? (
            <button
              type="button"
              className="mk-btn ghost"
              onClick={() => setShowMore(true)}
              style={{ fontSize: 13 }}
            >
              + Add dates, budget, delivery
            </button>
          ) : null}
        </div>
        {state.message ? <p className="mk-msg err">{state.message}</p> : null}
      </form>
    </div>
  );
}

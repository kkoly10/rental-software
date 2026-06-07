"use client";

import { useActionState } from "react";
import {
  setPrimaryOrgVertical,
  type SetPrimaryVerticalState,
} from "@/lib/verticals/actions";

/**
 * Phase 4g — inline "↑ primary" button rendered next to each non-
 * primary chip in the verticals card. Posts the slug to
 * setPrimaryOrgVertical; the RPC handles the atomic swap.
 *
 * Same compact styling as the remove button so the chip row stays
 * read-mostly; status surfaces via title-attr tooltip.
 */
const initialState: SetPrimaryVerticalState = { ok: false, message: "" };

export function SetPrimaryButton({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    setPrimaryOrgVertical,
    initialState,
  );

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="vertical_slug" value={slug} />
      <button
        type="submit"
        aria-label={`Make ${slug} primary`}
        title={state.message || `Make ${slug.replace(/-/g, " ")} primary`}
        disabled={pending}
        style={{
          background: "transparent",
          border: "none",
          marginLeft: 4,
          padding: 0,
          cursor: pending ? "wait" : "pointer",
          color: "inherit",
          fontSize: 12,
          lineHeight: 1,
          opacity: pending ? 0.5 : 0.7,
        }}
      >
        ↑
      </button>
    </form>
  );
}

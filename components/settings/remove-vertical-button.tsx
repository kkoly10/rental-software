"use client";

import { useActionState } from "react";
import { removeOrgVertical, type RemoveVerticalState } from "@/lib/verticals/actions";

/**
 * Phase 4f — inline ✕ for non-primary vertical chips on the settings
 * page. Posts the slug to removeOrgVertical (#295/#296 companion);
 * the action filters out the primary row server-side, so even if a
 * caller renders the button on a primary chip the delete no-ops.
 *
 * Submit happens via a tiny client-side <form action={...}> so the
 * action's revalidatePath rebuilds the chip list without a hard
 * reload. Errors surface as title-attr tooltips (kept tiny on
 * purpose — the verticals card is read-mostly).
 */

const initialState: RemoveVerticalState = { ok: false, message: "" };

export function RemoveVerticalButton({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    removeOrgVertical,
    initialState,
  );

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="vertical_slug" value={slug} />
      <button
        type="submit"
        aria-label={`Remove ${slug}`}
        title={state.message || `Remove ${slug.replace(/-/g, " ")}`}
        disabled={pending}
        style={{
          background: "transparent",
          border: "none",
          marginLeft: 6,
          padding: 0,
          cursor: pending ? "wait" : "pointer",
          color: "inherit",
          fontSize: 12,
          lineHeight: 1,
          opacity: pending ? 0.5 : 0.7,
        }}
      >
        ✕
      </button>
    </form>
  );
}

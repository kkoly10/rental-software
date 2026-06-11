"use client";

import { useActionState } from "react";
import { joinWorldWaitlist, type WaitlistState } from "@/lib/market/actions";

const initialState: WaitlistState = { ok: false, message: "" };

export function WaitlistForm({
  worldSlug,
  metroSlug,
}: {
  worldSlug: string;
  metroSlug: string;
}) {
  const [state, formAction, pending] = useActionState(joinWorldWaitlist, initialState);

  if (state.ok) {
    return <p className="mk-msg ok">✓ {state.message}</p>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="metroSlug" value={metroSlug} />
      <div className="mk-waitlist">
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          aria-label="Email for the waitlist"
        />
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Notify me"}
        </button>
      </div>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}

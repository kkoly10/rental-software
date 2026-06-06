import type { Capability } from "../types.ts";

/**
 * Setup-window capability — products declaring this have a defined
 * pre-event arrival window. The crew pull sheet renders arrival time
 * as `event_start - setup_minutes_before`, so the operator and
 * driver both see "show up by 11:00 AM for the 1:00 PM event."
 *
 * Used by tents (2–4 hours), dance floors (1–2 hours), and photo
 * booths (~60 min) when Phase 2 wires them up.
 *
 * Schema: products.setup_minutes_before integer (added in
 * supabase/migrations/20260608_050000_setup_window.sql).
 */

export type SetupWindowInput = {
  /** ISO timestamp of the event start. */
  eventStartIso: string;
  /** Minutes before event start the crew should arrive. */
  setupMinutesBefore: number;
};

/**
 * Compute the crew arrival ISO. Throws on an invalid eventStartIso
 * so a bad input is loud at the caller — silently passing through
 * an invalid arrival time would be far worse than a crash.
 */
export function computeCrewArrivalIso(input: SetupWindowInput): string {
  const start = new Date(input.eventStartIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`computeCrewArrivalIso: invalid eventStartIso "${input.eventStartIso}"`);
  }
  const minutes = Math.max(0, input.setupMinutesBefore);
  const arrival = new Date(start.getTime() - minutes * 60_000);
  return arrival.toISOString();
}

export const setupWindowCapability: Capability = {
  slug: "setup.setup-window",
  group: "setup",
  i18nKey: "capabilities.setup.setupWindow",
};

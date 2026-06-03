/**
 * Cadence math for recurring order series (Sprint 3).
 *
 * Pure functions — no Supabase, no clock dependency beyond what's
 * passed in. Lets us unit-test the entire scheduling surface against
 * concrete dates without touching a database.
 *
 * Frequency vocabulary:
 *   daily      — next event is N days later
 *   weekly     — next event is N weeks later
 *   biweekly   — kept as a distinct value because it's the most-asked
 *                cadence; mathematically equivalent to weekly N=2 but
 *                surfaces nicer in the UI dropdown
 *   monthly    — next event is N calendar months later. Day-of-month
 *                is preserved when possible; if the source day doesn't
 *                exist in the target month (e.g., Jan 31 → Feb), we
 *                fall back to the last day of the target month.
 *   quarterly  — same logic as monthly but N×3 months apart.
 */
export type SeriesFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly";

export type SeriesCadence = {
  frequency: SeriesFrequency;
  intervalCount: number; // multiplier, 1-52
};

/**
 * The hard cap on how many child orders any single expansion call may
 * emit. Prevents an indefinite series + bad input from filling a
 * Postgres table with a million rows. The daily cron re-fills as
 * children get consumed.
 */
export const MAX_EXPANSION_HORIZON_DAYS = 730; // 2 years
export const MAX_EXPANSION_BATCH = 104; // ~2 years of weekly

/**
 * Given an anchor event date, compute the next occurrence's event
 * date for the supplied cadence. Returns an ISO date string
 * (YYYY-MM-DD) so we don't introduce a timezone every time we add
 * days.
 */
export function nextOccurrenceDate(
  anchor: string,
  cadence: SeriesCadence,
): string {
  const date = parseDateOnly(anchor);

  switch (cadence.frequency) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + cadence.intervalCount);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7 * cadence.intervalCount);
      break;
    case "biweekly":
      date.setUTCDate(date.getUTCDate() + 14 * cadence.intervalCount);
      break;
    case "monthly":
      return shiftByMonths(anchor, cadence.intervalCount);
    case "quarterly":
      return shiftByMonths(anchor, 3 * cadence.intervalCount);
  }
  return formatDateOnly(date);
}

/**
 * Enumerate every occurrence date for a series within a window. Used
 * by the expansion routine to know what child orders to generate.
 *
 * Termination:
 *   - end_date inclusive: stop at the first occurrence > end_date
 *   - max_occurrences: stop after N occurrences (1-indexed)
 *   - through (caller-supplied horizon): never emit dates past it
 *
 * If both end_date and max_occurrences are set, the first one to
 * trigger wins. If neither is set, `through` is the only stop.
 *
 * Returns occurrences sorted by date ascending. The first emitted
 * occurrence's index is `startingOccurrence` (1-indexed) so the
 * caller can backfill series_occurrence_number on each child order.
 */
export function enumerateOccurrences(input: {
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  cadence: SeriesCadence;
  /** Last event_date that's already been generated. NULL when no children exist yet. */
  alreadyGeneratedThrough: string | null;
  /** Hard horizon — don't emit anything past this. Inclusive. */
  through: string;
  /** Cap on emissions in this single call. Defaults to MAX_EXPANSION_BATCH. */
  batchLimit?: number;
}): { occurrences: { eventDate: string; occurrenceNumber: number }[]; reachedTerminus: boolean } {
  const batchLimit = input.batchLimit ?? MAX_EXPANSION_BATCH;
  const result: { eventDate: string; occurrenceNumber: number }[] = [];

  // For monthly/quarterly cadence, compute every occurrence date as
  // (startDate + N months) rather than `nextOccurrenceDate(prev)`. The
  // iterative path drifts permanently when the source day doesn't
  // exist in a target month: Jan 31 → Feb 28 → Mar 28 → Apr 28 (the
  // bouncy-castle customer who booked the 31st silently shifts to the
  // 28th forever). Anchoring to startDate clamps in February but
  // recovers Mar 31 / Apr 30 / May 31. Daily/weekly/biweekly don't
  // have this drift hazard so they keep the lighter incremental walk.
  const isAnchorCadence =
    input.cadence.frequency === "monthly" ||
    input.cadence.frequency === "quarterly";
  const monthsPerCycle =
    input.cadence.frequency === "monthly"
      ? input.cadence.intervalCount
      : input.cadence.frequency === "quarterly"
      ? input.cadence.intervalCount * 3
      : 0;

  let current = input.startDate;
  let occurrenceNumber = 0;

  // Safety: bound the loop so a degenerate cadence (e.g., daily over
  // a 100-year horizon) can't spin forever. We exit via the
  // `current > through` check, but cap iterations as defense in depth.
  for (let iter = 0; iter < 100000; iter += 1) {
    occurrenceNumber += 1;
    const eventDate = current;

    // max_occurrences cap (1-indexed)
    if (input.maxOccurrences !== null && occurrenceNumber > input.maxOccurrences) {
      return { occurrences: result, reachedTerminus: true };
    }

    // end_date cap (inclusive)
    if (input.endDate !== null && eventDate > input.endDate) {
      return { occurrences: result, reachedTerminus: true };
    }

    // horizon cap (inclusive) — soft, doesn't mean series is done.
    if (eventDate > input.through) {
      return { occurrences: result, reachedTerminus: false };
    }

    // Skip if this occurrence was already emitted on a previous run.
    if (input.alreadyGeneratedThrough === null || eventDate > input.alreadyGeneratedThrough) {
      result.push({ eventDate, occurrenceNumber });
      if (result.length >= batchLimit) {
        // Soft cap hit. Caller will pick up on the next cron pass.
        return { occurrences: result, reachedTerminus: false };
      }
    }

    if (isAnchorCadence) {
      current = shiftByMonths(input.startDate, occurrenceNumber * monthsPerCycle);
    } else {
      current = nextOccurrenceDate(current, input.cadence);
    }
  }

  // Loop guard fired. Treat as soft stop — daily cron will retry.
  return { occurrences: result, reachedTerminus: false };
}

/**
 * Add N calendar months to a YYYY-MM-DD string. Preserves the day-of-
 * month when possible; clamps to the last day of the target month
 * when the source day doesn't exist (e.g., Jan 31 + 1 month = Feb 28
 * or 29 depending on the year).
 */
function shiftByMonths(anchor: string, months: number): string {
  const [y, m, d] = anchor.split("-").map((s) => Number(s));
  const targetMonthIndex = m - 1 + months; // 0-indexed
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12; // 0-indexed, handle negative
  const daysInTarget = daysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(d, daysInTarget);
  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

function daysInMonth(year: number, monthIndex0: number): number {
  // Month-index 0 is January. Day 0 of next month gives last day of
  // current month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function parseDateOnly(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Default horizon for an expansion call. Today + 2 years. Used by the
 * eager-expand on series create and by the daily cron.
 */
export function defaultExpansionHorizon(today: Date): string {
  const horizon = new Date(today.getTime());
  horizon.setUTCDate(horizon.getUTCDate() + MAX_EXPANSION_HORIZON_DAYS);
  return formatDateOnly(horizon);
}

export type AvailabilityWindow = {
  startsAt: string;
  endsAt: string;
};

/**
 * Build an availability window for a given date and optional time range.
 *
 * When startTime and endTime are provided (HH:MM format), the window is
 * scoped to those exact hours on the event date. This allows same-day
 * split bookings (e.g. 9am-12pm and 2pm-6pm on the same bounce house).
 *
 * When times are not provided, the window spans midnight-to-midnight UTC
 * for the given date (full-day block).
 *
 * Setup / breakdown buffers (Sprint 5.5 + PR-1): the window extends
 * backwards by `setupMinutesBefore` and forwards by
 * `breakdownMinutesAfter`. A Saturday tent with 4h setup blocks
 * Friday afternoon. Defaults are 0 — calls without product metadata
 * preserve the original behavior.
 */
export function getAvailabilityWindowForDate(
  eventDate?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  endDate?: string | null,
  setupMinutesBefore?: number | null,
  breakdownMinutesAfter?: number | null
): AvailabilityWindow | null {
  if (!eventDate) {
    return null;
  }

  const dayStart = new Date(`${eventDate}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    return null;
  }

  const setupMs = Math.max(0, setupMinutesBefore ?? 0) * 60_000;
  const breakdownMs = Math.max(0, breakdownMinutesAfter ?? 0) * 60_000;
  const applyBuffer = (startIso: string, endIso: string) => ({
    startsAt: setupMs ? new Date(new Date(startIso).getTime() - setupMs).toISOString() : startIso,
    endsAt: breakdownMs ? new Date(new Date(endIso).getTime() + breakdownMs).toISOString() : endIso,
  });

  // Multi-day rental: span from the start day's midnight through the day AFTER
  // the end date, so every day in the range is reserved/checked (not just day 1).
  if (endDate && endDate > eventDate) {
    const endDayStart = new Date(`${endDate}T00:00:00.000Z`);
    if (!Number.isNaN(endDayStart.getTime())) {
      const end = new Date(endDayStart);
      end.setUTCDate(end.getUTCDate() + 1);
      return applyBuffer(dayStart.toISOString(), end.toISOString());
    }
  }

  // When both start and end times are provided, use the exact time window.
  // Equal times (e.g. startTime=14:00, endTime=14:00) used to silently
  // fall through to the full-day window — operators expecting a zero-
  // length slot got a 24-hour block instead. Explicitly reject the
  // degenerate case so the caller can surface a validation error
  // rather than over-reserving inventory.
  if (startTime && endTime && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)) {
    const start = new Date(`${eventDate}T${startTime}:00.000Z`);
    const end = new Date(`${eventDate}T${endTime}:00.000Z`);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      if (end <= start) {
        // Reject end <= start: zero/negative windows are user error,
        // not "fall back to a full-day block."
        return null;
      }
      return applyBuffer(start.toISOString(), end.toISOString());
    }
  }

  // Fall back to full-day window (midnight to midnight)
  const end = new Date(dayStart);
  end.setUTCDate(end.getUTCDate() + 1);

  return applyBuffer(dayStart.toISOString(), end.toISOString());
}

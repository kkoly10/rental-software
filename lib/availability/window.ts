export type AvailabilityWindow = {
  startsAt: string;
  endsAt: string;
};

/**
 * Build an availability window for a given date and optional time range.
 *
 * Currently date-based only: the window spans midnight-to-midnight UTC for the
 * given date. This means two events on the same date (e.g. 9am-12pm and
 * 2pm-6pm) are treated as a conflict even though they don't overlap in time.
 *
 * TODO: Implement time-window overlap detection to support same-day multiple bookings.
 * When startTime / endTime are provided, the window should be
 *   starts_at = eventDate + startTime (with timezone)
 *   ends_at   = eventDate + endTime   (with timezone)
 * and conflict detection in check.ts should compare overlapping TIME windows,
 * not just matching dates. This enables scenarios like morning party 9am-12pm
 * AND afternoon party 2pm-6pm on the same bounce house.
 */
export function getAvailabilityWindowForDate(
  eventDate?: string | null,
  _startTime?: string | null,
  _endTime?: string | null
): AvailabilityWindow | null {
  if (!eventDate) {
    return null;
  }

  const start = new Date(`${eventDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  // TODO: When time-window overlap detection is implemented, use startTime/endTime
  // instead of full-day window. For now, always use midnight-to-midnight.
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

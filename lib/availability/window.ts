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
 */
export function getAvailabilityWindowForDate(
  eventDate?: string | null,
  startTime?: string | null,
  endTime?: string | null
): AvailabilityWindow | null {
  if (!eventDate) {
    return null;
  }

  const dayStart = new Date(`${eventDate}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    return null;
  }

  // When both start and end times are provided, use the exact time window
  if (startTime && endTime && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)) {
    const start = new Date(`${eventDate}T${startTime}:00.000Z`);
    const end = new Date(`${eventDate}T${endTime}:00.000Z`);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      };
    }
  }

  // Fall back to full-day window (midnight to midnight)
  const end = new Date(dayStart);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startsAt: dayStart.toISOString(),
    endsAt: end.toISOString(),
  };
}

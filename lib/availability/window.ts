export type AvailabilityWindow = {
  startsAt: string;
  endsAt: string;
};

export function getAvailabilityWindowForDate(eventDate?: string | null): AvailabilityWindow | null {
  if (!eventDate) {
    return null;
  }

  const start = new Date(`${eventDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

const cache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeZip(
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return null;

  if (cache.has(normalized)) {
    return cache.get(normalized) ?? null;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${normalized}&country=US&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RentalSoftware/1.0 (service-area-map)" },
    });

    if (!res.ok) {
      cache.set(normalized, null);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(normalized, null);
      return null;
    }

    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    cache.set(normalized, result);
    return result;
  } catch {
    cache.set(normalized, null);
    return null;
  }
}

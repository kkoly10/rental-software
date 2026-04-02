/**
 * Server-side geocoding via Nominatim with in-memory cache and rate limiting.
 * Nominatim requires max 1 request/second — we enforce 1100ms between requests.
 */

const USER_AGENT = "Korent/1.0 (support@korent.app)";
const MIN_DELAY_MS = 1100;

type Coords = { lat: number; lng: number };

const cache = new Map<string, Coords | null>();

let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function geocodeZipServer(
  zip: string
): Promise<Coords | null> {
  const key = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(key)) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  await throttle();

  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(key)}&country=US&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, null);
      return null;
    }

    const result: Coords = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

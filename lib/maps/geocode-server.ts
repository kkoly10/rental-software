/**
 * Server-side geocoding via Nominatim with in-memory cache and rate limiting.
 * Nominatim requires max 1 request/second — we enforce 1100ms between requests.
 */

const USER_AGENT = "Korent/1.0 (support@korent.app)";
const MIN_DELAY_MS = 1100;

type Coords = { lat: number; lng: number };
type CacheEntry = { coords: Coords | null; expiresAt: number };

// Negative results expire so a transient Nominatim failure doesn't poison a
// ZIP for the lifetime of the process; successful lookups are cached forever.
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  // Reserve this request's slot synchronously to reduce the chance that two
  // concurrent callers both pass the gate and fire at once.
  const scheduled = Math.max(now, lastRequestTime + MIN_DELAY_MS);
  lastRequestTime = scheduled;
  const wait = scheduled - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
}

export async function geocodeZipServer(
  zip: string
): Promise<Coords | null> {
  const key = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(key)) return null;
  const cached = cache.get(key);
  if (cached && (cached.coords !== null || cached.expiresAt > Date.now())) {
    return cached.coords;
  }

  await throttle();

  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(key)}&country=US&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      cache.set(key, { coords: null, expiresAt: Date.now() + NEGATIVE_TTL_MS });
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, { coords: null, expiresAt: Date.now() + NEGATIVE_TTL_MS });
      return null;
    }

    const result: Coords = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
    cache.set(key, { coords: result, expiresAt: Infinity });
    return result;
  } catch {
    cache.set(key, { coords: null, expiresAt: Date.now() + NEGATIVE_TTL_MS });
    return null;
  }
}

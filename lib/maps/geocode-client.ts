/**
 * Client-side geocoding via Nominatim with in-memory cache and rate limiting.
 * Nominatim requires max 1 request/second — we enforce 1100ms between requests.
 */

const USER_AGENT = "Korent/1.0 (support@korent.app)";
const MIN_DELAY_MS = 1100;

type Coords = { lat: number; lng: number };
type CacheEntry = { coords: Coords | null; expiresAt: number };

// Negative results expire so a single transient Nominatim failure doesn't
// poison a ZIP for the entire page session; positives stay cached.
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

let queue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(() => delay(MIN_DELAY_MS)).then(fn);
  // Keep the queue chain alive even if fn rejects
  queue = p.then(() => {}, () => {});
  return p;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readCache(key: string): Coords | null | undefined {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.coords !== null || cached.expiresAt > Date.now()) {
    return cached.coords;
  }
  return undefined;
}

export async function geocodeZipClient(zip: string): Promise<Coords | null> {
  const key = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(key)) return null;
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  return enqueue(async () => {
    const cachedInQueue = readCache(key);
    if (cachedInQueue !== undefined) return cachedInQueue;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${key}&country=US&format=json&limit=1`,
        { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) }
      );
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
  });
}

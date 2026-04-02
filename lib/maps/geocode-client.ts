/**
 * Client-side geocoding via Nominatim with in-memory cache and rate limiting.
 * Nominatim requires max 1 request/second — we enforce 1100ms between requests.
 */

const USER_AGENT = "Korent/1.0 (support@korent.app)";
const MIN_DELAY_MS = 1100;

type Coords = { lat: number; lng: number };

const cache = new Map<string, Coords | null>();

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

export async function geocodeZipClient(zip: string): Promise<Coords | null> {
  const key = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(key)) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  return enqueue(async () => {
    // Re-check cache — may have been populated while waiting in queue
    if (cache.has(key)) return cache.get(key) ?? null;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${key}&country=US&format=json&limit=1`,
        { headers: { "User-Agent": USER_AGENT } }
      );
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
  });
}

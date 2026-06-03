import { getOptionalEnv } from "../../env.ts";
import type {
  OptimizerProviderResult,
  RouteOptimizerProvider,
} from "../route-optimizer.ts";

/**
 * Mapbox Optimization v2 provider (Sprint 5).
 *
 * Pricing as of June 2026: $2 per 1,000 requests on the on-demand
 * plan, $0 on the free tier (50k requests/month). Each route
 * optimization is a single request.
 *
 * API: https://docs.mapbox.com/api/navigation/optimization-v2/
 *
 * The v2 API uses an async "submit a problem → poll for solution"
 * pattern. For small problems (≤12 stops typical for party rentals)
 * the solution is ready within 1-2 seconds, so we poll synchronously
 * with a short timeout rather than introducing a webhook + queue.
 *
 * The fetcher is intentionally narrow — it takes a fully-resolved
 * list of (id, lat, lng) and emits the ordering. The locked-stop /
 * unoptimizable-stop / sequence-renumber logic lives one layer up in
 * the orchestration (`runOptimization`).
 */
export function makeMapboxProvider(): RouteOptimizerProvider {
  return {
    id: "mapbox",
    async optimize(input) {
      const token = getOptionalEnv("MAPBOX_ACCESS_TOKEN");
      if (!token) {
        return {
          ok: false,
          reason: "not_configured",
          detail: "MAPBOX_ACCESS_TOKEN env var is not set",
        };
      }

      // Build the request body. Mapbox expects an array of locations
      // and an `outings` array describing the driver(s). For our
      // single-driver case there's one outing with a route_unique_id.
      const locations = input.stops.map((s) => ({
        name: s.id,
        coordinates: [s.lng, s.lat],
      }));

      // Optional origin/destination land as anchor locations at
      // positions 0 / last.
      if (input.origin) {
        locations.unshift({
          name: "__origin__",
          coordinates: [input.origin.lng, input.origin.lat],
        });
      }
      if (input.destination) {
        locations.push({
          name: "__destination__",
          coordinates: [input.destination.lng, input.destination.lat],
        });
      }

      const problem = {
        locations,
        vehicles: [{ name: "driver_1" }],
        services: input.stops.map((s) => ({ name: s.id, location: s.id })),
      };

      try {
        const submitResp = await fetch(
          `https://api.mapbox.com/optimized-trips/v2?access_token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(problem),
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (submitResp.status === 429) {
          return { ok: false, reason: "rate_limited", detail: "Mapbox rate limit hit" };
        }
        if (submitResp.status >= 400 && submitResp.status < 500) {
          return {
            ok: false,
            reason: "validation",
            detail: await submitResp.text().catch(() => ""),
          };
        }
        if (submitResp.status >= 500) {
          return {
            ok: false,
            reason: "server",
            detail: await submitResp.text().catch(() => ""),
          };
        }

        const submitBody = (await submitResp.json()) as { id?: string };
        const problemId = submitBody.id;
        if (!problemId) {
          return {
            ok: false,
            reason: "validation",
            detail: "Mapbox returned no problem id",
          };
        }

        // Poll for solution. v2 typically resolves within 1-2 seconds
        // for small problems; cap polling at 8 seconds to stay well
        // inside Vercel's request envelope.
        const deadline = Date.now() + 8_000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (Date.now() > deadline) {
            return { ok: false, reason: "server", detail: "Mapbox solution polling timed out" };
          }
          await new Promise((r) => setTimeout(r, 500));

          const pollResp = await fetch(
            `https://api.mapbox.com/optimized-trips/v2/${problemId}?access_token=${encodeURIComponent(token)}`,
            { signal: AbortSignal.timeout(5_000) },
          );
          if (pollResp.status === 202) continue; // still solving
          if (pollResp.status >= 500) {
            return { ok: false, reason: "server", detail: await pollResp.text().catch(() => "") };
          }
          if (pollResp.status >= 400) {
            return { ok: false, reason: "validation", detail: await pollResp.text().catch(() => "") };
          }
          const solution = (await pollResp.json()) as MapboxSolution;
          return mapSolution(solution);
        }
      } catch (err) {
        return {
          ok: false,
          reason: "network",
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

type MapboxSolution = {
  routes?: {
    stops?: { location: string }[];
    distance?: number;
    duration?: number;
  }[];
};

function mapSolution(solution: MapboxSolution): OptimizerProviderResult {
  const route = solution.routes?.[0];
  if (!route?.stops) {
    return { ok: false, reason: "validation", detail: "Mapbox solution had no route" };
  }
  const orderedStopIds = route.stops
    .map((s) => s.location)
    .filter((id) => id !== "__origin__" && id !== "__destination__");
  return {
    ok: true,
    orderedStopIds,
    totalDistanceMeters: Math.round(route.distance ?? 0),
    totalDurationSeconds: Math.round(route.duration ?? 0),
  };
}

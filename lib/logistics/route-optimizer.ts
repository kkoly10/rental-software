/**
 * Route optimizer interface (Sprint 5).
 *
 * Pure types + the provider abstraction. The actual fetcher
 * implementations live in `./optimizers/*.ts` and the server action
 * that ties them to Supabase lives in `optimize-route-action.ts`.
 *
 * Keeping this module pure (no DB, no fetch) means we can unit-test
 * the orchestration — locked-stop preservation, sequence
 * reassignment, distance/time summarization — without booting
 * anything network-side.
 */

export type OptimizeStop = {
  id: string;
  /** Existing sequence (1-indexed). Used to preserve order for locked stops. */
  sequence: number;
  /** Status. Stops in 'en_route', 'completed', 'skipped' are locked. */
  status: "pending" | "en_route" | "completed" | "skipped";
  /** Coordinates. Stops missing coords are dropped from optimization with a flag. */
  lat: number | null;
  lng: number | null;
};

export type OptimizeInput = {
  /** Origin (warehouse / driver start). Optional — defaults to the first delivery if unset. */
  origin?: { lat: number; lng: number };
  /** Optional explicit destination. When unset, the optimizer treats the last stop as the end. */
  destination?: { lat: number; lng: number };
  stops: OptimizeStop[];
};

export type OptimizeResult = {
  /** Stop ids in optimized order. Locked stops keep their original sequence at the head. */
  orderedStopIds: string[];
  /** Total drive distance across the resequenced route, in meters. */
  totalDistanceMeters: number;
  /** Total drive time, in seconds. */
  totalDurationSeconds: number;
  /** Stop ids that were dropped from optimization (e.g., missing coords). */
  unoptimizedStopIds: string[];
};

/**
 * Provider contract. The orchestration layer (`runOptimization`)
 * handles the locked-stop / unoptimizable-stop / sequence-renumber
 * logic; each provider only needs to call its API and return the
 * geometry + ordering.
 */
export type RouteOptimizerProvider = {
  id: "mapbox" | "google_routes";
  /**
   * Given a list of optimizable stops (already filtered for locked
   * status + missing coords), return them in shortest-path order
   * plus the total distance + time. Never throws — failures return
   * a typed error so the orchestration can fall back gracefully.
   */
  optimize(input: {
    origin?: { lat: number; lng: number };
    destination?: { lat: number; lng: number };
    stops: { id: string; lat: number; lng: number }[];
  }): Promise<OptimizerProviderResult>;
};

export type OptimizerProviderResult =
  | {
      ok: true;
      orderedStopIds: string[];
      totalDistanceMeters: number;
      totalDurationSeconds: number;
    }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "rate_limited"
        | "validation"
        | "server"
        | "network";
      detail?: string;
    };

/**
 * The orchestration:
 *   1. Split stops into locked vs optimizable. Locked stops keep
 *      their existing sequence and are emitted at the head of the
 *      ordered list. Optimizable stops with missing coords land in
 *      unoptimizedStopIds and tail behind everyone else.
 *   2. Hand the optimizable stops to the provider.
 *   3. Concatenate: [locked-in-order, provider-ordered,
 *      unoptimized-tail].
 *
 * Returns a single OptimizeResult that the server action can use to
 * resequence the route_stops rows + bump routes.last_optimized_at.
 */
export async function runOptimization(
  input: OptimizeInput,
  provider: RouteOptimizerProvider,
): Promise<{ ok: true; result: OptimizeResult } | { ok: false; reason: string; detail?: string }> {
  // 1. Partition.
  const lockedStatuses: OptimizeStop["status"][] = ["en_route", "completed", "skipped"];
  const locked = input.stops
    .filter((s) => lockedStatuses.includes(s.status))
    .sort((a, b) => a.sequence - b.sequence);
  const candidates = input.stops.filter((s) => !lockedStatuses.includes(s.status));

  const optimizable = candidates.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
  ) as { id: string; sequence: number; status: OptimizeStop["status"]; lat: number; lng: number }[];
  const unoptimizable = candidates.filter(
    (s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng),
  );

  // 2. Short-circuit when nothing meaningful to optimize.
  if (optimizable.length < 2) {
    return {
      ok: true,
      result: {
        orderedStopIds: [
          ...locked.map((s) => s.id),
          ...optimizable.map((s) => s.id),
          ...unoptimizable.map((s) => s.id),
        ],
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        unoptimizedStopIds: unoptimizable.map((s) => s.id),
      },
    };
  }

  // 3. Hand to provider.
  const providerResult = await provider.optimize({
    origin: input.origin,
    destination: input.destination,
    stops: optimizable.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })),
  });

  if (!providerResult.ok) {
    return { ok: false, reason: providerResult.reason, detail: providerResult.detail };
  }

  // 4. Concatenate.
  return {
    ok: true,
    result: {
      orderedStopIds: [
        ...locked.map((s) => s.id),
        ...providerResult.orderedStopIds,
        ...unoptimizable.map((s) => s.id),
      ],
      totalDistanceMeters: providerResult.totalDistanceMeters,
      totalDurationSeconds: providerResult.totalDurationSeconds,
      unoptimizedStopIds: unoptimizable.map((s) => s.id),
    },
  };
}

"use client";

import { RouteMap } from "@/components/maps/route-map";
import type { RouteStopEnhanced } from "@/lib/types";

type Props = {
  stops: RouteStopEnhanced[];
  height?: string;
};

/**
 * Client wrapper that lets server components (dispatcher route detail
 * page and crew mobile view) mount the Leaflet-based RouteMap without
 * pulling it directly into a server boundary.
 */
export function RouteDetailMapWrapper({ stops, height }: Props) {
  return <RouteMap stops={stops} showRoute interactive height={height} />;
}

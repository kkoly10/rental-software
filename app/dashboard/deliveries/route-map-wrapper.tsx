"use client";

import { RouteMap } from "@/components/maps/route-map";
import type { RouteStopEnhanced } from "@/lib/types";

type Props = {
  stops: RouteStopEnhanced[];
  height?: string;
};

export function RouteMapWrapper({ stops, height }: Props) {
  return <RouteMap stops={stops} showRoute height={height} />;
}

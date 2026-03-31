"use client";

import { RouteTimeline } from "@/components/deliveries/route-timeline";
import type { RouteStopEnhanced } from "@/lib/types";

type Props = {
  stops: RouteStopEnhanced[];
};

export function RouteDetailTimeline({ stops }: Props) {
  return <RouteTimeline stops={stops} />;
}

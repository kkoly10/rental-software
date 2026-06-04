import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { geocodeZipServer } from "@/lib/maps/geocode-server";
import { formatTimeInTimeZone } from "@/lib/datetime/event-time";
import { getOrgEventTimezone } from "@/lib/datetime/org-timezone";
import { getMessages } from "@/lib/i18n/server";
import { formatInflatableItemLine } from "@/lib/inflatable/format-item-line";
import type { RouteDetail, RouteDetailEnhanced, RouteStopEnhanced } from "@/lib/types";

export type RouteStopData = {
  id: string;
  sequence: number;
  label: string;
  time: string;
  type: string;
  status: string;
  address?: string;
  productName?: string;
  proofPhotoUrl?: string;
  signatureName?: string;
  /** Sprint 5.5 — pickup-side photo (the "after" of the before/after pair). */
  pickupPhotoUrl?: string;
  /** Sprint 5.5 — pickup-side customer signature. */
  pickupSignatureName?: string;
  /**
   * Sprint 5.5 — for pickup-type stops, the matching delivery photo
   * from the same order so the PickupPhotoUpload component can render
   * its "match this angle" visual nudge.
   */
  matchingDeliveryPhotoUrl?: string;
  /** Sprint 5.5 — order id used to resolve the matching delivery photo. */
  orderId?: string;
};

const fallbackStops: RouteStopData[] = [
  { id: "stop_1", sequence: 1, label: "Johnson Birthday", time: "9:00 AM", type: "Delivery", status: "assigned", proofPhotoUrl: undefined, signatureName: undefined },
  { id: "stop_2", sequence: 2, label: "Church Event", time: "11:00 AM", type: "Delivery", status: "assigned", proofPhotoUrl: undefined, signatureName: undefined },
  { id: "stop_3", sequence: 3, label: "School Field Day", time: "4:00 PM", type: "Pickup", status: "assigned", proofPhotoUrl: undefined, signatureName: undefined },
];

const fallbackRouteDetail: RouteDetail = {
  id: "route_1",
  name: "Crew A Morning Route",
  crewLabel: "Driver + setup technician",
  vehicleLabel: "Truck 1 · Trailer attached",
  summaryLabel: "3 deliveries · 1 pickup later today",
  stops: [
    "1. Johnson Birthday · Stafford · 9:00 AM · Delivery",
    "2. Church Event · Fredericksburg · 11:00 AM · Delivery",
    "3. School Field Day · Pickup at 4:00 PM · Pickup",
  ],
};

export async function getRouteDetail(routeId: string): Promise<RouteDetail> {
  if (!hasSupabaseEnv()) {
    return { ...fallbackRouteDetail, id: routeId };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    notFound();
  }
  const tz = await getOrgEventTimezone(ctx.organizationId);

  const supabase = await createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id, name, assigned_vehicle, route_status, profiles(full_name)")
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (routeError || !route) {
    notFound();
  }

  const { data: stops } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_type, scheduled_window_start, stop_status, orders(order_number, customers(first_name, last_name))"
    )
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true })
    // Explicit cap so a route with an unexpectedly huge stop list is bounded
    // instead of relying on PostgREST's default 1000-row truncation.
    .limit(500);

  const driver = (route as Record<string, unknown>).profiles as {
    full_name: string;
  } | null;

  return {
    id: route.id,
    name: route.name ?? "Route",
    crewLabel: driver?.full_name ?? "Unassigned crew",
    vehicleLabel: route.assigned_vehicle ?? "No vehicle assigned",
    summaryLabel: `${stops?.length ?? 0} stops · ${(route.route_status ?? "planned").replace(/_/g, " ")}`,
    stops:
      stops && stops.length > 0
        ? stops.map((stop, index) => {
            const seq = stop.stop_sequence ?? index + 1;
            const order = (stop as Record<string, unknown>).orders as {
              order_number: string;
              customers: { first_name: string; last_name: string } | null;
            } | null;
            const customer = order?.customers;
            const label = customer
              ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
              : order?.order_number ?? "Stop";
            const time = stop.scheduled_window_start
              ? formatTimeInTimeZone(stop.scheduled_window_start, tz)
              : "TBD";
            const type = (stop.stop_type ?? "delivery").replace(
              /\b\w/g,
              (c: string) => c.toUpperCase()
            );
            const status = (stop.stop_status ?? "assigned")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            return `${seq}. ${label} · ${time} · ${type} · ${status}`;
          })
        : ["No stops assigned yet"],
  };
}

export async function getRouteStops(routeId: string): Promise<RouteStopData[]> {
  if (!hasSupabaseEnv()) {
    return fallbackStops;
  }

  const ctx = await getOrgContext();
  if (!ctx) return [];
  const tz = await getOrgEventTimezone(ctx.organizationId);
  // Sprint 6.0 — locale-aware item line labels for crew today.
  const i18nMessages = await getMessages();
  const inflatableLabels = i18nMessages.forms.editProduct.inflatableSetup;

  const supabase = await createSupabaseServerClient();
  const { data: stops, error } = await supabase
    .from("route_stops")
    .select("id, order_id, stop_sequence, stop_type, scheduled_window_start, stop_status, proof_photo_url, signature_name, pickup_photo_url, pickup_signature_name, routes!inner(organization_id), orders(order_number, delivery_address_id, customers(first_name, last_name), customer_addresses!delivery_address_id(line1, city, state), order_items(item_name_snapshot, selected_mode, products(anchoring_methods, required_anchor_count)))")
    .eq("route_id", routeId)
    .eq("routes.organization_id", ctx.organizationId)
    .order("stop_sequence", { ascending: true });

  if (error) {
    console.error("[route-detail] getRouteStops query failed:", error.message);
    return [];
  }

  if (!stops || stops.length === 0) {
    return [];
  }

  // Sprint 5.5 — for any pickup-type stops on this route, fetch the
  // matching delivery stop's proof_photo_url so the crew UI can show
  // the "match this angle" visual nudge. Same-order pairing: the
  // delivery stop may live on a different route from the pickup.
  const pickupOrderIds = stops
    .filter((s) => (s.stop_type ?? "delivery") === "pickup")
    .map((s) => (s as Record<string, unknown>).order_id as string | null)
    .filter((id): id is string => Boolean(id));

  const deliveryPhotosByOrder = new Map<string, string>();
  if (pickupOrderIds.length > 0) {
    const { data: deliveryStops } = await supabase
      .from("route_stops")
      .select("order_id, proof_photo_url, routes!inner(organization_id)")
      .in("order_id", pickupOrderIds)
      .eq("stop_type", "delivery")
      .eq("routes.organization_id", ctx.organizationId)
      .not("proof_photo_url", "is", null);
    for (const row of deliveryStops ?? []) {
      const orderId = row.order_id as string;
      const photoUrl = row.proof_photo_url as string;
      if (orderId && photoUrl && !deliveryPhotosByOrder.has(orderId)) {
        deliveryPhotosByOrder.set(orderId, photoUrl);
      }
    }
  }

  return stops.map((stop, index) => {
    const order = (stop as Record<string, unknown>).orders as {
      order_number: string;
      customers: { first_name: string; last_name: string } | null;
      customer_addresses: { line1?: string; city?: string; state?: string } | null;
      order_items: {
        item_name_snapshot?: string;
        selected_mode?: string | null;
        products?: {
          anchoring_methods?: string[] | null;
          required_anchor_count?: number | null;
        } | null;
      }[] | null;
    } | null;
    const customer = order?.customers;
    const addr = order?.customer_addresses;
    const addressParts = [addr?.line1, addr?.city, addr?.state].filter(Boolean);
    // Sprint 6.0 — surface mode + anchoring inline with the product
    // name so the crew today card shows everything they need to load.
    // Uses the shared formatter so operator/crew labels stay
    // consistent with the order detail page and the pull sheet.
    const firstItem = order?.order_items?.[0];
    const productName = firstItem?.item_name_snapshot
      ? formatInflatableItemLine(
          {
            itemName: firstItem.item_name_snapshot,
            selectedMode: firstItem.selected_mode,
            anchoringMethods: firstItem.products?.anchoring_methods ?? null,
            requiredAnchorCount: firstItem.products?.required_anchor_count ?? null,
          },
          inflatableLabels,
          inflatableLabels.bringPrefix,
        )
      : undefined;
    return {
      id: stop.id,
      sequence: stop.stop_sequence ?? index + 1,
      label: customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : order?.order_number ?? "Stop",
      time: stop.scheduled_window_start
        ? formatTimeInTimeZone(stop.scheduled_window_start, tz)
        : "TBD",
      type: (stop.stop_type ?? "delivery").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      status: stop.stop_status ?? "assigned",
      address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
      productName,
      orderId: (stop as Record<string, unknown>).order_id as string | undefined,
      proofPhotoUrl: (stop as Record<string, unknown>).proof_photo_url as string | undefined,
      pickupPhotoUrl: (stop as Record<string, unknown>).pickup_photo_url as string | undefined,
      pickupSignatureName: (stop as Record<string, unknown>).pickup_signature_name as string | undefined,
      matchingDeliveryPhotoUrl:
        (stop.stop_type ?? "delivery") === "pickup"
          ? deliveryPhotosByOrder.get(
              (stop as Record<string, unknown>).order_id as string,
            )
          : undefined,
      signatureName: (stop as Record<string, unknown>).signature_name as string | undefined,
    };
  });
}

/* ── Enhanced route detail with lat/lng and address data ── */

const fallbackEnhancedStops: RouteStopEnhanced[] = [
  {
    id: "stop_1",
    sequence: 1,
    type: "delivery",
    status: "completed",
    address: "123 Oak Lane, Stafford, VA 22554",
    customerName: "Johnson Birthday Party",
    scheduledTime: "9:00 AM",
    lat: 38.4220,
    lng: -77.4083,
  },
  {
    id: "stop_2",
    sequence: 2,
    type: "delivery",
    status: "in_progress",
    address: "456 Main St, Fredericksburg, VA 22401",
    customerName: "Community Church Event",
    scheduledTime: "11:00 AM",
    lat: 38.3032,
    lng: -77.4605,
  },
  {
    id: "stop_3",
    sequence: 3,
    type: "delivery",
    status: "assigned",
    address: "789 School Rd, Spotsylvania, VA 22553",
    customerName: "Riverview Elementary Field Day",
    scheduledTime: "1:30 PM",
    lat: 38.1996,
    lng: -77.5892,
  },
  {
    id: "stop_4",
    sequence: 4,
    type: "pickup",
    status: "assigned",
    address: "321 Park Ave, Stafford, VA 22554",
    customerName: "Martinez Wedding (pickup)",
    scheduledTime: "4:00 PM",
    lat: 38.4301,
    lng: -77.3672,
  },
];

const fallbackEnhancedDetail: RouteDetailEnhanced = {
  id: "route_1",
  name: "Crew A Morning Route",
  routeDate: "Mar 31, 2026",
  routeDateRaw: "2026-03-31",
  routeStatus: "in_progress",
  crewLabel: "Driver + setup technician",
  vehicleLabel: "Truck 1 · Trailer attached",
  totalStops: 4,
  completedStops: 1,
  inProgressStops: 1,
  nextDeliveryTime: "1:30 PM",
  stops: fallbackEnhancedStops,
};

export async function getRouteDetailEnhanced(
  routeId: string
): Promise<RouteDetailEnhanced> {
  if (!hasSupabaseEnv()) {
    return { ...fallbackEnhancedDetail, id: routeId };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    notFound();
  }
  const tz = await getOrgEventTimezone(ctx.organizationId);

  const supabase = await createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id, name, route_date, assigned_vehicle, route_status, profiles(full_name)")
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (routeError || !route) {
    notFound();
  }

  // Join through: route_stops → orders → customers (for name)
  //              route_stops → orders → customer_addresses (via delivery_address_id, for address + coords)
  const { data: rawStops } = await supabase
    .from("route_stops")
    .select(
      "id, order_id, stop_sequence, stop_type, scheduled_window_start, scheduled_window_end, stop_status, orders(order_number, order_status, delivery_address_id, customers(first_name, last_name), customer_addresses!delivery_address_id(id, line1, city, state, postal_code, latitude, longitude))"
    )
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  // Exclude stops whose linked order has been cancelled
  const stops = (rawStops ?? []).filter((stop) => {
    const order = (stop as Record<string, unknown>).orders as { order_status?: string } | null;
    return order?.order_status !== "cancelled";
  });

  const driver = (route as Record<string, unknown>).profiles as {
    full_name: string;
  } | null;

  // Build stops, then lazily geocode any that have a postal code but no coordinates
  type AddressToGeocode = { addressId: string; postalCode: string; stopIndex: number };
  const toGeocode: AddressToGeocode[] = [];

  const enhancedStops: RouteStopEnhanced[] = stops.map((stop, index) => {
    const order = (stop as Record<string, unknown>).orders as {
      order_number: string;
      order_status?: string;
      delivery_address_id?: string;
      customers: {
        first_name: string;
        last_name: string;
      } | null;
      customer_addresses: {
        id: string;
        line1?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        latitude?: number;
        longitude?: number;
      } | null;
    } | null;

    const customer = order?.customers;
    const addr = order?.customer_addresses;

    // `customerName` consumers (the deliveries detail page) use
    // `stop.customerName ?? fallback`, which only catches null/undefined,
    // not empty strings.  Fall through to the order number or undefined
    // so the i18n fallback fires when both names are blank.
    const trimmedName = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "";
    const name = trimmedName || order?.order_number || undefined;

    const addressParts = [
      addr?.line1,
      addr?.city,
      addr?.state,
      addr?.postal_code,
    ].filter(Boolean);

    const time = stop.scheduled_window_start
      ? formatTimeInTimeZone(stop.scheduled_window_start, tz)
      : undefined;

    const lat = addr?.latitude ?? undefined;
    const lng = addr?.longitude ?? undefined;

    // Queue for geocoding if we have a postal code but no coordinates
    if (lat == null && lng == null && addr?.postal_code && addr?.id) {
      toGeocode.push({ addressId: addr.id, postalCode: addr.postal_code, stopIndex: index });
    }

    return {
      id: stop.id,
      orderId: (stop as Record<string, unknown>).order_id as string | undefined,
      sequence: stop.stop_sequence ?? index + 1,
      type: (stop.stop_type ?? "delivery") as "delivery" | "pickup",
      status: (stop.stop_status ?? "assigned") as RouteStopEnhanced["status"],
      address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
      customerName: name,
      scheduledTime: time,
      lat,
      lng,
    };
  });

  // Lazily geocode addresses that lack coordinates, then cache the result back.
  // Run in parallel — sequential geocoding blocks render by ~1s per stop.
  if (toGeocode.length > 0) {
    await Promise.all(
      toGeocode.map(async (item) => {
        const coords = await geocodeZipServer(item.postalCode);
        if (coords) {
          enhancedStops[item.stopIndex].lat = coords.lat;
          enhancedStops[item.stopIndex].lng = coords.lng;
          await supabase
            .from("customer_addresses")
            .update({ latitude: coords.lat, longitude: coords.lng })
            .eq("id", item.addressId);
        }
      })
    );
  }

  const completedStops = enhancedStops.filter((s) => s.status === "completed").length;
  const inProgressStops = enhancedStops.filter((s) => s.status === "in_progress").length;
  const nextStop = enhancedStops.find(
    (s) => s.status === "assigned" || s.status === "en_route"
  );

  return {
    id: route.id,
    name: route.name ?? "Route",
    routeDate: route.route_date
      ? new Date(route.route_date + "T12:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "TBD",
    routeDateRaw: route.route_date ?? new Date().toISOString().slice(0, 10),
    routeStatus: route.route_status ?? "planned",
    crewLabel: driver?.full_name ?? "Unassigned crew",
    vehicleLabel: route.assigned_vehicle ?? "No vehicle assigned",
    totalStops: enhancedStops.length,
    completedStops,
    inProgressStops,
    nextDeliveryTime: nextStop?.scheduledTime,
    stops: enhancedStops,
  };
}
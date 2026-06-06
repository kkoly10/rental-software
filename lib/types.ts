export type StatusTone = "default" | "success" | "warning" | "danger";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: string;
  description: string;
  status: string;
  imageUrl?: string;
};

export type OrderSummary = {
  id: string;
  customer: string;
  item: string;
  date: string;
  total: string;
  status: string;
  tone: StatusTone;
  eventDateRaw?: string;
  /** True when the order has no event_date. Surfaces the noob trap where
      an order is invisible to the calendar / route board until a date
      is set. Decided in 2.5 — allow null with prominent flagging. */
  missingEventDate?: boolean;
  postalCode?: string;
};

export type ProductSummary = {
  id: string;
  name: string;
  category: string;
  price: string;
  status: string;
  tone: StatusTone;
  /** True when the product is active but has no base price set. Surfaces
      decision 2.9: an unpriced active product fails checkout, so the
      operator needs to know it's broken on the storefront. */
  missingPrice?: boolean;
  /** True when at least one asset of this product has an open or
      in-progress maintenance record. Storefront availability is
      capacity-aware (per decision 2.4) so the product may still be
      bookable if other assets are ready — but the operator should be
      told so they're not surprised when a "maintenance" item still
      takes bookings. */
  hasOpenMaintenance?: boolean;
  /** Patch 4 — primary product photo for the catalog grid. */
  imageUrl?: string;
};

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  latestBooking: string;
  latestDate: string;
};

export type PaymentSummary = {
  id: string;
  customer: string;
  item: string;
  label: string;
  date: string;
  type: string;
  status: string;
};

export type DocumentSummary = {
  id: string;
  name: string;
  agreement: string;
  waiver: string;
  orderId: string;
};

export type RouteSummary = {
  id: string;
  name: string;
  date: string;
  status: string;
  stops: number;
  driverName?: string;
  /** Display-ready earliest scheduled time across all stops (e.g. "9:00 AM").
      Surfaced on the delivery board so dispatchers can see when each route
      kicks off without opening the detail page. Undefined when no stop on
      the route has a `scheduled_window_start` set. */
  earliestStopTime?: string;
  /** Display-ready latest scheduled time. Same source / undefined rules as
      `earliestStopTime`. */
  latestStopTime?: string;
};

export type ServiceAreaSummary = {
  id: string;
  name: string;
  fee: string;
  minimum: string;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  eventDate: string;
  /** True when the underlying event_date column is null. Surfaced as a
      banner on the order detail page (decision 2.5). */
  missingEventDate?: boolean;
  eventStartTime?: string;
  eventEndTime?: string;
  items: string[];
  deliveryLabel: string;
  deliverySurfaceType?: string;
  deliveryGateCode?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliverySetupNotes?: string;
  documents: string[];
  documentObjects: { id: string; type: string; status: string }[];
  subtotal: string;
  deliveryFee: string;
  depositPaid: string;
  depositDue?: string;
  balanceDue: string;
  total: string;
  notes: string;
};

export type CustomerDetail = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredLocale: string;
  addressLabel: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  notes: string;
  /** Sprint 4.5 — WhatsApp opt-in flag, surfaced as a toggle on the customer detail page. */
  whatsappOptedIn: boolean;
  /** Sprint 4.5 — optional override when the WhatsApp number differs from the primary phone. */
  whatsappNumber: string;
  orders: { id: string; label: string }[];
};

export type RouteDetail = {
  id: string;
  name: string;
  crewLabel: string;
  vehicleLabel: string;
  summaryLabel: string;
  stops: string[];
};

export type RouteStopEnhanced = {
  id: string;
  orderId?: string;
  sequence: number;
  type: "delivery" | "pickup";
  status: "assigned" | "en_route" | "in_progress" | "completed";
  address?: string;
  customerName?: string;
  scheduledTime?: string;
  lat?: number;
  lng?: number;
};

export type RouteDetailEnhanced = {
  id: string;
  name: string;
  routeDate: string;
  routeDateRaw: string;
  routeStatus: string;
  crewLabel: string;
  vehicleLabel: string;
  totalStops: number;
  completedStops: number;
  inProgressStops: number;
  nextDeliveryTime?: string;
  stops: RouteStopEnhanced[];
};

export type CatalogDetail = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: string;
  description: string;
  highlights: string[];
  imageUrl?: string;
  galleryImages?: string[];
  // Sprint 6.0 — inflatable-vertical optional fields. Surfaced to the
  // storefront so the customer can pick wet/dry. NULL/empty means
  // the storefront renders no toggle and behaves like every other
  // product.
  supportsModes?: string[];
  wetUpchargeCents?: number | null;
  basePriceCents?: number;
  // Phase 2e.6 — capability-aware PDP rendering.
  capabilitySlugs?: string[];
  hourlyRateCents?: number | null;
  minimumHours?: number | null;
};
export type StatusTone = "default" | "success" | "warning" | "danger";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: string;
  /** Headline rate in cents for reliable numeric sorting — avoids re-parsing
   *  the formatted `price` string (which varies by pricing model). Optional so
   *  loosely-typed callers (e.g. the PDP's inline listing) don't have to set it;
   *  sort falls back to parsing `price` when absent. */
  priceCents?: number;
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
  /** Raw address parts for the add/edit form on the order detail
      page; null when the order has no linked delivery address. */
  deliveryAddress?: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  deliverySurfaceType?: string;
  deliveryGateCode?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliverySetupNotes?: string;
  documents: string[];
  documentObjects: { id: string; type: string; status: string }[];
  subtotal: string;
  deliveryFee: string;
  tax: string;
  depositPaid: string;
  /** Raw deposit-paid amount as a number — used by the refund flow
   *  to suggest a default refund and cap the input. Mirrors
   *  `depositPaid` (which is the formatted display string). */
  depositPaidAmount: number;
  /** Used to scope the saved-card picker to this customer's
   *  payment_methods. Null on the demo fallback row. */
  customerId: string | null;
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
  // Phase 2e.13b — per-unit pricing on the PDP. unitPriceCents drives
  // the line total, unitLabel makes the customer-facing display human
  // ("$5 per chair × 200 = $1,000"), minimumOrderQuantity gates the
  // selector's lower bound so the customer can't submit below the
  // operator's minimum.
  unitPriceCents?: number | null;
  unitLabel?: string | null;
  minimumOrderQuantity?: number | null;
  damageWaiverRateBps?: number | null;
  // Phase 1c — capacity calculator fields surfaced on the PDP as
  // an interactive guest-count → recommendation widget.
  capacityMetric?: "guests" | "sq_ft" | "dancers" | "servings" | null;
  capacityValue?: number | null;
  // Phase 2e.8 — structured specs table on the PDP.
  specs?: Array<{
    id: string;
    specKey: string;
    specLabel: string;
    specValue: string;
    displayOrder: number;
  }>;
  // Phase 2e.9 — variant gallery picker on the PDP.
  variants?: Array<{
    id: string;
    label: string;
    thumbnailUrl: string | null;
    previewImageUrl: string | null;
    priceDeltaCents: number;
    isDefault: boolean;
    displayOrder: number;
  }>;
  // Phase 2e.10 — composition.add-ons surfacing. The PDP renders a
  // checkbox/qty selector per row; checkout passes selections via
  // ?addons=id:qty,id:qty. Each addon's basePriceCents drives a
  // child order_items line via parent_order_item_id at submit.
  addOns?: Array<{
    addonProductId: string;
    name: string;
    basePriceCents: number;
    defaultQuantity: number;
    maxQuantity: number | null;
    isRequired: boolean;
    displayOrder: number;
  }>;
};
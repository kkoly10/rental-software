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
  postalCode?: string;
};

export type ProductSummary = {
  id: string;
  name: string;
  category: string;
  price: string;
  status: string;
  tone: StatusTone;
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
};
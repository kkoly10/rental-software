export type StatusTone = "default" | "success" | "warning" | "danger";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: string;
  description: string;
  status: string;
};

export type OrderSummary = {
  id: string;
  customer: string;
  item: string;
  date: string;
  total: string;
  status: string;
  tone: StatusTone;
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
  items: string[];
  deliveryLabel: string;
  documents: string[];
  subtotal: string;
  deliveryFee: string;
  depositPaid: string;
  balanceDue: string;
  total: string;
  notes: string;
};

export type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  addressLabel: string;
  notes: string;
  orders: string[];
};

export type RouteDetail = {
  id: string;
  name: string;
  crewLabel: string;
  vehicleLabel: string;
  summaryLabel: string;
  stops: string[];
};

export type CatalogDetail = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: string;
  description: string;
  highlights: string[];
};

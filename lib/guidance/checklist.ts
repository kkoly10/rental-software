import type { GuidanceSnapshot } from "@/lib/data/guidance-snapshot";

export type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  order: number;
  isComplete: (snapshot: GuidanceSnapshot) => boolean;
};

export const checklistItems: ChecklistItem[] = [
  {
    id: "business-profile",
    title: "Complete your business profile",
    description: "Add your support email and phone number so customers can reach you.",
    href: "/dashboard/settings",
    order: 1,
    isComplete: (s) => s.hasBusinessProfile,
  },
  {
    id: "first-product",
    title: "Add your first product",
    description: "Create an inflatable listing with pricing and details for your catalog.",
    href: "/dashboard/products/new",
    order: 2,
    isComplete: (s) => s.productsCount > 0,
  },
  {
    id: "first-image",
    title: "Upload a product image",
    description: "Add photos to your products so customers can see what they're renting.",
    href: "/dashboard/products",
    order: 3,
    isComplete: (s) => s.productImagesCount > 0,
  },
  {
    id: "service-area",
    title: "Add a service area",
    description: "Define delivery zones with ZIP codes, fees, and minimum order amounts.",
    href: "/dashboard/service-areas",
    order: 4,
    isComplete: (s) => s.serviceAreasCount > 0,
  },
  {
    id: "test-order",
    title: "Create a test order",
    description: "Walk through the order flow to see how bookings work from start to finish.",
    href: "/dashboard/orders/new",
    order: 5,
    isComplete: (s) => s.ordersCount > 0,
  },
  {
    id: "test-payment",
    title: "Record a test payment",
    description: "Practice recording a deposit or balance payment against an order.",
    href: "/dashboard/payments",
    order: 6,
    isComplete: (s) => s.paymentsCount > 0,
  },
  {
    id: "test-documents",
    title: "Generate test documents",
    description: "Create a rental agreement and safety waiver for an order.",
    href: "/dashboard/documents",
    order: 7,
    isComplete: (s) => s.documentsCount > 0,
  },
  {
    id: "website-message",
    title: "Customize your homepage message",
    description: "Set a hero message that appears on your public storefront.",
    href: "/dashboard/website",
    order: 8,
    isComplete: (s) => s.hasWebsiteSettings,
  },
  {
    id: "brand-setup",
    title: "Set up your brand identity",
    description: "Upload your logo and choose brand colors to make your storefront uniquely yours.",
    href: "/dashboard/website",
    order: 9,
    isComplete: () => false, // Manual — always shown until dismissed
  },
  {
    id: "pricing-rules",
    title: "Configure pricing rules",
    description: "Set up weekend surcharges, early bird discounts, or seasonal rates to maximize revenue.",
    href: "/dashboard/pricing",
    order: 10,
    isComplete: () => false, // Manual — always shown until dismissed
  },
  {
    id: "sms-setup",
    title: "Enable SMS notifications",
    description: "Keep customers in the loop with automated text messages for order confirmations and delivery updates.",
    href: "/dashboard/settings#sms-notifications",
    order: 11,
    isComplete: () => false, // Manual — always shown until dismissed
  },
  {
    id: "review-storefront",
    title: "Review your storefront",
    description: "Preview how your public booking site looks to customers, including the delivery map and weather alerts.",
    href: "/",
    order: 12,
    isComplete: () => false, // Manual — always shown until dismissed
  },
  {
    id: "share-link",
    title: "Share your booking link",
    description: "Send your storefront URL to a friend or customer for feedback.",
    href: "/dashboard/website",
    order: 13,
    isComplete: () => false, // Manual — always shown until dismissed
  },
];

export function computeChecklist(snapshot: GuidanceSnapshot) {
  const items = checklistItems.map((item) => ({
    ...item,
    completed: item.isComplete(snapshot),
  }));

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const nextStep = items.find((i) => !i.completed) ?? null;

  return { items, completed, total, nextStep };
}

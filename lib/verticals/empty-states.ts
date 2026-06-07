/**
 * Phase 3c — vertical-aware empty-state copy.
 *
 * Maps the operator's business_type (set at onboarding by the
 * vertical picker, #287) to short, domain-specific copy for the
 * dashboard's zero-state cards. A tents operator sees "Add your
 * first tent" instead of generic "rental product" everywhere they
 * land on an empty list.
 *
 * Returns null when the org's business_type doesn't match a
 * registry vertical (legacy car / equipment orgs); callers fall
 * back to the existing i18n strings so nothing regresses.
 *
 * Surfaces wired today: products, orders, customers. Add new
 * surfaces by appending to the EmptyStateSurface union and the
 * per-vertical record.
 */

export type EmptyStateSurface = "products" | "orders" | "customers";

export type EmptyStateCopy = {
  title: string;
  description: string;
  actionLabel: string;
};

const COPY: Record<string, Record<EmptyStateSurface, EmptyStateCopy>> = {
  inflatable: {
    products: {
      title: "No bouncers yet",
      description:
        "Add your first inflatable so customers can book bounce houses, water slides, and combos from your storefront.",
      actionLabel: "Add bouncer",
    },
    orders: {
      title: "No bookings yet",
      description:
        "Share your storefront link or take a phone order to land your first party rental.",
      actionLabel: "Create booking",
    },
    customers: {
      title: "No customers yet",
      description:
        "Customers appear here after their first booking. Add a returning birthday parent manually to get a head start.",
      actionLabel: "Add customer",
    },
  },
  tents: {
    products: {
      title: "No tents yet",
      description:
        "Add your first tent so customers can book frame tents, pole tents, sidewalls, and lighting from your storefront.",
      actionLabel: "Add tent",
    },
    orders: {
      title: "No bookings yet",
      description:
        "Share your storefront link or enter a wedding inquiry by hand to start the season.",
      actionLabel: "Create booking",
    },
    customers: {
      title: "No customers yet",
      description:
        "Wedding planners + venue contacts go here. Add a returning vendor manually to seed your CRM.",
      actionLabel: "Add customer",
    },
  },
  "tables-and-chairs": {
    products: {
      title: "No tables or chairs yet",
      description:
        "Add your first chair or table so customers can build their event order with Chiavari, banquet, and linen rentals.",
      actionLabel: "Add inventory",
    },
    orders: {
      title: "No orders yet",
      description:
        "Open your storefront for online quotes or add a phone order to start logging the season.",
      actionLabel: "Create order",
    },
    customers: {
      title: "No customers yet",
      description:
        "Caterers + venue managers usually book repeat. Add one manually to start building your repeat-business list.",
      actionLabel: "Add customer",
    },
  },
  "dance-floors": {
    products: {
      title: "No dance floors yet",
      description:
        "Add your first dance floor or stage section so customers can size their venue at checkout.",
      actionLabel: "Add dance floor",
    },
    orders: {
      title: "No bookings yet",
      description:
        "DJs and venue partners drive most of these. Take an inbound call and log it here to track repeat sources.",
      actionLabel: "Create booking",
    },
    customers: {
      title: "No customers yet",
      description:
        "Add your usual DJs and venue partners so repeat bookings auto-fill at checkout.",
      actionLabel: "Add customer",
    },
  },
};

export function getEmptyStateCopy(
  businessType: string | undefined,
  surface: EmptyStateSurface,
): EmptyStateCopy | null {
  if (!businessType) return null;
  const vertical = COPY[businessType];
  return vertical ? vertical[surface] : null;
}

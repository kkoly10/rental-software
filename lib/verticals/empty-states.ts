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
  "photo-booths": {
    products: {
      title: "No booths yet",
      description:
        "Add your first photo booth so customers can pick a backdrop, see the 3-hour minimum priced honestly, and book online.",
      actionLabel: "Add booth",
    },
    orders: {
      title: "No bookings yet",
      description:
        "Most photo-booth bookings come from wedding planners and corporate event coordinators. Share your storefront link or take a phone order to start.",
      actionLabel: "Create booking",
    },
    customers: {
      title: "No customers yet",
      description:
        "Add planners and coordinators you've worked with so their next booking auto-fills at checkout.",
      actionLabel: "Add customer",
    },
  },
  concessions: {
    products: {
      title: "No machines yet",
      description:
        "Add your first concession machine so customers can see servings yield, power requirements, and the 1-hour-attendant-included pricing.",
      actionLabel: "Add machine",
    },
    orders: {
      title: "No bookings yet",
      description:
        "Concession bookings often bundle with inflatables — share your storefront link or take a phone order to log your first event.",
      actionLabel: "Create booking",
    },
    customers: {
      title: "No customers yet",
      description:
        "Carnival-circuit and school-event repeat customers go here. Add one manually to seed your repeat-business list.",
      actionLabel: "Add customer",
    },
  },
  // Setup-only general vertical — neutral copy that reads for any rental
  // business (tools, AV, furniture, equipment, party, and beyond).
  other: {
    products: {
      title: "No products yet",
      description:
        "Add your first item so customers can see what you rent and book it online from your storefront.",
      actionLabel: "Add product",
    },
    orders: {
      title: "No bookings yet",
      description:
        "Share your storefront link or enter a booking by hand to get your first rental on the board.",
      actionLabel: "Create booking",
    },
    customers: {
      title: "No customers yet",
      description:
        "Customers appear here after their first booking. Add a returning customer manually to get a head start.",
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

/**
 * Phase 3d — first-product starter example.
 *
 * Shown on the "Creating your first product" banner on
 * /dashboard/products/new so the operator sees a concrete example
 * matching their vertical instead of abstract "use a real product
 * name" advice. They can copy the values verbatim and tweak.
 *
 * Returns null for unknown verticals; the banner falls back to the
 * existing generic tips.
 */
export type StarterExample = {
  name: string;
  price: string;
  description: string;
};

const STARTERS: Record<string, StarterExample> = {
  inflatable: {
    name: "13ft Castle Bouncer",
    price: "$165 / day",
    description:
      "Classic castle inflatable. 13x13 footprint, ages 3-10, max 6 jumpers. Includes blower + stakes.",
  },
  tents: {
    name: "20x40 Frame Tent",
    price: "$650 / day",
    description:
      "Pole-free frame tent for grass, concrete, or asphalt. Seats ~80 banquet / 60 cocktail. Sidewalls extra.",
  },
  "tables-and-chairs": {
    name: "Chiavari Chair — Gold",
    price: "$3.50 / chair",
    description:
      "Classic Chiavari chair with cushion. 50-chair minimum order. Stackable for easy delivery.",
  },
  "dance-floors": {
    name: "12x12 Parquet Dance Floor",
    price: "$450 / event",
    description:
      "Modular parquet sections, 12x12 (sixteen 3x3 panels). Sub-floor included. Indoor or covered tent only.",
  },
  "photo-booths": {
    name: "Open-Air Photo Booth — 3hr",
    price: "$600 / 3hr (then $150/hr)",
    description:
      "DSLR camera, ring light, 6 backdrop options, prop kit, attendant included. 3-hour minimum. Needs one 110V outlet.",
  },
  concessions: {
    name: "Popcorn Machine",
    price: "$175 (1hr attendant included)",
    description:
      "16oz commercial popper, serves ~200 guests. Kernels + bags + butter included. Standard 110V power.",
  },
  // Neutral example for a generalist — a real item with a clear daily
  // rate and the spec/condition details a renter looks for.
  other: {
    name: "Cordless Drill Kit",
    price: "$35 / day",
    description:
      "18V brushless drill/driver with two batteries, charger, and bit set in a hard case. Tested before every rental.",
  },
};

export function getStarterExample(
  businessType: string | undefined,
): StarterExample | null {
  if (!businessType) return null;
  return STARTERS[businessType] ?? null;
}

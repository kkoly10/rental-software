/**
 * Per-vertical marketing-landing copy — English-only by design, same
 * precedent as VerticalConfig.marketing.features (Phase 2b note in
 * lib/verticals/types.ts). These strings exist to win the
 * "<vertical> rental software" SERP and convert the operator who
 * typed it, so they are keyword-exact and intentionally not run
 * through the i18n pipeline.
 *
 * Copy strategy per docs/design research (Booqable + Goodshuffle Pro
 * vertical-page teardowns, 2026 CRO consensus):
 *  - h1: exact-match keyword + lived pain, ≤ 8 words
 *  - sub: outcome sentence naming the operator's actual workflow
 *  - hardWay/korentWay: the "Hard Way vs Smart Way" comparison rows
 *  - faqs: People-Also-Ask-style intent questions + product questions
 *  - closer: seasonal-urgency final CTA line
 */

export type VerticalLandingCopy = {
  h1: string;
  sub: string;
  hardWayTitle: string;
  rows: ReadonlyArray<{ hard: string; korent: string }>;
  faqs: ReadonlyArray<{ q: string; a: string }>;
  closer: string;
};

const COPY: Record<string, VerticalLandingCopy> = {
  inflatable: {
    h1: "Inflatable rental software that fills your weekends.",
    sub: "Online booking storefront, delivery routing, and signed waivers — so you're loading trucks, not answering calls.",
    hardWayTitle: "Running bounce houses the hard way",
    rows: [
      {
        hard: "Phone rings all Saturday while you're staking a castle in someone's backyard.",
        korent: "Customers check real-time availability and book online — deposits collected before you ever talk.",
      },
      {
        hard: "A double-booked combo unit and two angry birthday moms.",
        korent: "Inventory holds prevent double-booking the moment a deposit lands.",
      },
      {
        hard: "Crew texts at 7am asking which truck has the blower and stakes.",
        korent: "Pull sheets list anchoring spec, surface type, and wet/dry mode per stop.",
      },
      {
        hard: "Chasing waiver signatures at the door while kids bounce unsupervised.",
        korent: "Liability waivers signed online before delivery — stored on the order.",
      },
    ],
    faqs: [
      {
        q: "What does inflatable rental software do?",
        a: "It runs the business around the bounce house: a booking storefront with real-time availability, deposits and payments, signed liability waivers, delivery routing with crew pull sheets, and damage deposits — all tied to each order.",
      },
      {
        q: "Is a bounce house rental business profitable?",
        a: "Operators commonly charge $175–$350 per unit per day, and a single trailer of inventory can produce strong weekend margins. The bottleneck is bookings administration — which is exactly what software removes.",
      },
      {
        q: "Can customers book online and pick wet or dry?",
        a: "Yes. Wet/dry mode is a first-class option at checkout with per-unit upcharges, and the crew pull sheet shows the chosen mode for every stop.",
      },
      {
        q: "How do delivery routes and crews work?",
        a: "Orders flow into dispatch with delivery windows, anchoring spec, and surface type. Crew members get a mobile view of today's stops without seeing your payment data.",
      },
      {
        q: "Does Korent handle waivers and damage deposits?",
        a: "Both. Customers sign the waiver online before delivery, and damage deposits can be held and released per order with Stripe.",
      },
      {
        q: "How long does setup take?",
        a: "Under 30 minutes for a starter catalog: add units, set prices and service-area ZIPs, connect Stripe, and your branded storefront is live on your own subdomain.",
      },
    ],
    closer: "Spring weekends book out fast. Have your storefront live before the next one.",
  },

  tents: {
    h1: "Tent rental software for crews, not paperwork.",
    sub: "Quote multi-day installs, track every pole and sidewall, and collect deposits online while your crew is still on the last job.",
    hardWayTitle: "Running tents the hard way",
    rows: [
      {
        hard: "Quoting a 40x60 install over three phone calls and a napkin sketch.",
        korent: "Customers request quotes online with date, site, and guest count attached.",
      },
      {
        hard: "Sidewalls in one spreadsheet, stakes in another, and a missing center pole on install day.",
        korent: "Inventory tracks every component, and orders reserve them the moment a deposit lands.",
      },
      {
        hard: "A cancelled wedding 6 days out with a crew already scheduled.",
        korent: "Cancellation policy windows and forfeit percentages enforce themselves at refund time.",
      },
      {
        hard: "Final balances chased by text the week of the event.",
        korent: "Balance reminders go out automatically; customers pay from their order portal.",
      },
    ],
    faqs: [
      {
        q: "What does tent rental software do?",
        a: "It manages the full tent job: online quotes and bookings, component-level inventory (tops, poles, sidewalls, stakes), multi-day event windows with setup buffers, deposits and balance collection, and crew scheduling for installs and strikes.",
      },
      {
        q: "Can it handle multi-day installs and strikes?",
        a: "Yes. Event windows include setup and breakdown buffers so a Saturday wedding blocks the install day before and the strike day after — no accidental back-to-back bookings.",
      },
      {
        q: "How are deposits and final balances handled?",
        a: "Customers pay a configurable deposit at booking and the balance before the event, with automatic reminders. Refunds follow your cancellation window and forfeit rules.",
      },
      {
        q: "Is a tent rental business profitable?",
        a: "Frame and pole tents command some of the highest line totals in event rentals — installs regularly run $1,500–$15,000+. The margin leaks are quoting delays and component chaos, which software closes.",
      },
      {
        q: "Does it track sidewalls, poles, and stakes separately?",
        a: "Yes — products can be composed of components so a 20x40 top reserves its poles, ropes, and stakes together.",
      },
      {
        q: "Can my crew see installs without seeing payments?",
        a: "Crew roles see today's stops, site notes, and component lists — never your revenue or customer payment details.",
      },
    ],
    closer: "Wedding season fills your calendar months out. Get quotes converting online now.",
  },

  "photo-booths": {
    h1: "Photo booth rental software that books itself.",
    sub: "Per-hour pricing with minimums, a clickable backdrop picker, and attendant scheduling — while you're out running tonight's event.",
    hardWayTitle: "Running booths the hard way",
    rows: [
      {
        hard: "Instagram DMs asking 'how much?' answered between events at 11pm.",
        korent: "Your storefront shows hourly pricing with the 3-hour minimum priced honestly.",
      },
      {
        hard: "Backdrop choices negotiated over screenshots and texts.",
        korent: "Customers pick from a visual backdrop gallery with price deltas built in.",
      },
      {
        hard: "An attendant double-booked across town on a Saturday night.",
        korent: "Attendant scheduling rides on the order; dispatch sees who's where.",
      },
      {
        hard: "Extra hours agreed verbally and never invoiced.",
        korent: "Extra-hour add-ons land as line items the customer selects and pays for.",
      },
    ],
    faqs: [
      {
        q: "What does photo booth rental software do?",
        a: "It books the booth: hourly pricing with minimum blocks, a visual backdrop picker, add-ons like extra hours and guest books, attendant scheduling, deposits, and a branded storefront customers book from directly.",
      },
      {
        q: "Is a photo booth business profitable?",
        a: "Industry-standard pricing runs ~$200/hour with a 3-hour minimum, and a single booth can clear strong margins on weekends alone. Most operators' ceiling is admin time — bookings, backdrop choices, and scheduling — which is what the software absorbs.",
      },
      {
        q: "Can customers pick a backdrop when they book?",
        a: "Yes — backdrops render as a clickable thumbnail gallery on the product page, each with an optional price delta, and the pick flows through to the order.",
      },
      {
        q: "How does per-hour pricing with a minimum work?",
        a: "You set the hourly rate and minimum block. Checkout reads the customer's start and end times, bills real hours, and never undercharges below the minimum.",
      },
      {
        q: "Can I run multiple booths the same night?",
        a: "Yes. Each booth is inventory; orders hold the specific unit, and dispatch shows which attendant is assigned to which event.",
      },
      {
        q: "Do I need a website first?",
        a: "No — Korent gives you a branded booking storefront on your own subdomain. Most operators replace their linktree-and-DMs flow with it on day one.",
      },
    ],
    closer: "Wedding and holiday-party season books months ahead. Put your calendar online first.",
  },

  concessions: {
    h1: "Concession rental software for carts that sell out.",
    sub: "Popcorn, cotton candy, and shaved ice carts with per-day pricing, supply add-ons, and attendant options — booked online.",
    hardWayTitle: "Running carts the hard way",
    rows: [
      {
        hard: "School event coordinators calling for quotes during your day job.",
        korent: "Coordinators book carts online with date and headcount; deposits collect automatically.",
      },
      {
        hard: "Guessing how many servings of supplies to pack per event.",
        korent: "Supply add-ons (servings, cones, syrups) are line items sized by the customer at checkout.",
      },
      {
        hard: "An attendant request remembered the night before.",
        korent: "Staffed vs self-serve is an option on the product; attendants schedule with the order.",
      },
      {
        hard: "Cart #2's wheel fixed twice because nobody logged it.",
        korent: "Maintenance logs ride on each unit so problem equipment is visible before it books.",
      },
    ],
    faqs: [
      {
        q: "What does concession rental software do?",
        a: "It books carts and machines online: per-day pricing, supply add-ons sized per event, staffed or self-serve options, deposits, delivery scheduling, and a storefront your school and corporate customers can order from directly.",
      },
      {
        q: "Is a concession rental business profitable?",
        a: "Carts rent for $100–$300/day with low maintenance overhead, and they attach naturally to bounce-house and party orders, raising average order value. The win is volume — which means frictionless online booking.",
      },
      {
        q: "Can customers add supplies for their headcount?",
        a: "Yes — supplies are add-on line items (per-50-servings, for example) the customer sizes at checkout, so carts arrive stocked for the actual crowd.",
      },
      {
        q: "Can I offer staffed and self-serve options?",
        a: "Both. Staffed events carry an attendant assignment visible to dispatch; self-serve rentals ship with instructions on the order.",
      },
      {
        q: "Does it work alongside my inflatable inventory?",
        a: "Yes — Korent is multi-vertical. Declare both lines of business and one storefront sells bounce houses and carts in the same cart.",
      },
      {
        q: "How fast can I get set up?",
        a: "Under 30 minutes: add carts, set day rates and supply add-ons, connect Stripe, share your storefront link.",
      },
    ],
    closer: "Field-day and festival season stacks up quickly. Take cart bookings online before it does.",
  },

  "dance-floors": {
    h1: "Dance floor rental software, sized and sold online.",
    sub: "Guest-count sizing, a visual surface picker, and crew install windows — quoted and booked without a single phone call.",
    hardWayTitle: "Running floors the hard way",
    rows: [
      {
        hard: "'What size floor for 120 guests?' answered by mental math on every call.",
        korent: "A built-in calculator turns guest count into conservative and generous section counts.",
      },
      {
        hard: "Parquet vs white vs LED debated over blurry texts.",
        korent: "Surfaces render as a clickable visual picker with per-surface price deltas.",
      },
      {
        hard: "An install crew booked against a floor that's still at last night's venue.",
        korent: "Setup windows and inventory holds keep installs physically possible.",
      },
      {
        hard: "Sections billed flat when the event needed irregular sizing.",
        korent: "Flat-day or per-section pricing per product — your choice, priced honestly at checkout.",
      },
    ],
    faqs: [
      {
        q: "What does dance floor rental software do?",
        a: "It sells floors the way operators size them: guest-count capacity calculator, visual surface picker (parquet, black, white, LED), per-section or flat-day pricing, crew install windows, and online deposits.",
      },
      {
        q: "How does guest-count sizing work?",
        a: "Industry rule built in: 30–50% of guests dancing at 4 sq ft each on 3'×3' sections. Customers enter a headcount and see conservative and generous section counts — no undersized floors.",
      },
      {
        q: "Can customers choose parquet, white, or LED?",
        a: "Yes — surfaces are visual variants with thumbnails and optional price deltas, picked on the product page and threaded through to the order.",
      },
      {
        q: "How are installs scheduled?",
        a: "Each order carries a setup window (typically 1–2 hours before the event) on the crew pull sheet, with the section count for the chosen size.",
      },
      {
        q: "Does it pair with tents and tables?",
        a: "Naturally — the wedding triad (tent + tables + floor) sells from one storefront in one checkout, one delivery, one invoice.",
      },
      {
        q: "What does it cost?",
        a: "Plans start at $49/month, including the storefront, online payments, inventory holds, and crew scheduling. No per-booking fees.",
      },
    ],
    closer: "Reception season is booked by spring. Put your floor catalog online ahead of it.",
  },

  "tables-and-chairs": {
    h1: "Tables and chairs rental software for bulk orders.",
    sub: "200 chairs in one line item — quantity pricing, component tracking, and delivery scheduling without the spreadsheet.",
    hardWayTitle: "Running tables & chairs the hard way",
    rows: [
      {
        hard: "A 200-chair order taken down by hand and keyed into a spreadsheet twice.",
        korent: "Bulk quantities are one line item with per-unit pricing — customers order 200 chairs in a single input.",
      },
      {
        hard: "Chiavari counts drifting between the warehouse and the truck.",
        korent: "Inventory holds track exact counts per order; what's reserved can't double-book.",
      },
      {
        hard: "Delivery fees recalculated per order in your head.",
        korent: "Service-area ZIPs carry delivery fees and minimums that apply themselves at checkout.",
      },
      {
        hard: "Linen colors confirmed over three emails.",
        korent: "Variants render as visual options the customer picks when they book.",
      },
    ],
    faqs: [
      {
        q: "What does tables and chairs rental software do?",
        a: "It handles volume: per-unit pricing with minimum order quantities, exact-count inventory holds, delivery fees by ZIP, linen and finish variants, and a storefront where a coordinator orders 200 chairs in one line.",
      },
      {
        q: "How does per-unit pricing work?",
        a: "Set a unit price and an optional minimum quantity. Customers enter a count, see the live subtotal, and can't check out below your minimum.",
      },
      {
        q: "Can it stop me from overbooking chairs?",
        a: "Yes — every order holds exact counts against your inventory for its event window, so 300 reserved chairs leave the rest bookable and no more.",
      },
      {
        q: "Is a tables and chairs rental business profitable?",
        a: "It's a volume business with long asset life — chairs pay for themselves in a handful of rentals. Profit scales with order count, which is why frictionless online ordering matters more here than anywhere.",
      },
      {
        q: "Can customers pick linen colors or chair finishes?",
        a: "Yes — variants with thumbnails and optional price deltas, selected at booking and printed on the pull sheet.",
      },
      {
        q: "Does delivery pricing apply automatically?",
        a: "Service areas carry per-ZIP delivery fees and order minimums that enforce themselves at checkout — no mental math, no undercharged deliveries.",
      },
    ],
    closer: "Graduation and wedding tables go fast. Open online ordering before the rush.",
  },
};

/** Fallback used if a vertical hasn't been given dedicated copy yet. */
const DEFAULT_COPY = COPY.inflatable;

export function getVerticalLandingCopy(slug: string): VerticalLandingCopy {
  return COPY[slug] ?? DEFAULT_COPY;
}

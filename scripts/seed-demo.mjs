/**
 * Idempotent seed script for the Korent demo organization.
 *
 * Usage:
 *   node scripts/seed-demo.mjs
 *   node scripts/seed-demo.mjs --reset   (delete + reseed all demo data)
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RESET = process.argv.includes("--reset");

// ---------------------------------------------------------------------------
// Stable IDs so rerunning is safe (upserts match on these)
// ---------------------------------------------------------------------------
const DEMO_ORG_SLUG = "demo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertOrg() {
  // Check if demo org exists
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", DEMO_ORG_SLUG)
    .maybeSingle();

  if (existing && RESET) {
    // Delete cascading data by deleting org-scoped records
    console.log("Resetting demo org data...");
    const orgId = existing.id;
    // Orders must be deleted before customers due to FK
    await supabase.from("availability_blocks").delete().eq("organization_id", orgId);
    await supabase.from("messages").delete().eq("organization_id", orgId);
    await supabase.from("notifications").delete().eq("organization_id", orgId);
    await supabase.from("order_items").delete().in(
      "order_id",
      (await supabase.from("orders").select("id").eq("organization_id", orgId)).data?.map(o => o.id) ?? []
    );
    await supabase.from("payments").delete().in(
      "order_id",
      (await supabase.from("orders").select("id").eq("organization_id", orgId)).data?.map(o => o.id) ?? []
    );
    await supabase.from("orders").delete().eq("organization_id", orgId);
    await supabase.from("customers").delete().eq("organization_id", orgId);
    await supabase.from("assets").delete().eq("organization_id", orgId);
    await supabase.from("products").delete().eq("organization_id", orgId);
    await supabase.from("categories").delete().eq("organization_id", orgId);
    await supabase.from("service_areas").delete().eq("organization_id", orgId);
    console.log("Demo data cleared.");
  }

  const orgData = {
    name: "Sunshine Party Rentals",
    slug: DEMO_ORG_SLUG,
    is_demo: true,
    business_type: "inflatable",
    timezone: "America/New_York",
    default_currency: "USD",
    support_email: "demo@korent.app",
    phone: "(555) 123-4567",
    subscription_status: "active",
    subscription_plan: "pro",
    settings: {
      deposit_percentage: 25,
      hero_headline: "Making Every Party Unforgettable",
      hero_message: "Premium bounce houses, water slides, and party packages delivered and set up for your event. Serving the greater metro area.",
      brand_primary_color: "#2563eb",
      brand_accent_color: "#f59e0b",
      brand_font_family: "DM Sans",
      about_text: "Sunshine Party Rentals has been bringing joy to backyard birthdays, school events, and community celebrations since 2019. We personally deliver, set up, and supervise every rental to ensure your event is safe and fun.",
      custom_faq: [
        { question: "How far in advance should I book?", answer: "We recommend booking at least 2 weeks ahead for weekends. Popular dates in summer fill up fast, so the earlier the better!" },
        { question: "What if it rains on my event day?", answer: "We offer free rescheduling up to 48 hours before your event. If weather turns bad day-of, we will work with you to find the next available date." },
        { question: "Do you set up and take down the inflatables?", answer: "Yes! Our crew handles delivery, full setup, safety anchoring, and takedown. We arrive 1-2 hours before your event start time." },
        { question: "Is a power source required?", answer: "Yes, inflatables need a standard 110V outlet within 50 feet. We can provide a generator rental for $75 if no outlet is available." },
        { question: "What about safety and insurance?", answer: "All units are commercially insured and inspected before every rental. We follow ASTM standards and provide safety instructions with every setup." },
      ],
      testimonials: [
        { name: "Maria G.", text: "Sunshine Party Rentals made my daughter's 7th birthday absolutely magical. The bounce house was spotless and the crew was so professional!", rating: 5 },
        { name: "James T.", text: "We use them for every school event now. Reliable, on-time, and the kids go crazy for the obstacle course. Highly recommend.", rating: 5 },
        { name: "Ashley R.", text: "Booked the water slide for our neighborhood block party. Setup was quick, everything was clean, and pickup was right on schedule. Will definitely book again!", rating: 5 },
      ],
      trust_badges: [
        { title: "Insured & Inspected", description: "Every unit commercially insured and inspected before each rental" },
        { title: "On-Time Guarantee", description: "We arrive 1-2 hours early so everything is ready when your guests arrive" },
        { title: "500+ Events", description: "Trusted by families and schools across the metro area since 2019" },
      ],
      social_facebook: "https://facebook.com/sunshinepartyrentals",
      social_instagram: "https://instagram.com/sunshinepartyrentals",
      section_visibility: {
        trust_bar: true,
        pain_points: true,
        benefits: true,
        category_grid: true,
        how_it_works: true,
        feature_showcase: true,
        integrations_bar: true,
        faq_section: true,
        about_section: true,
        testimonials: true,
        service_area_map: true,
      },
    },
  };

  if (existing) {
    const { error } = await supabase
      .from("organizations")
      .update(orgData)
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update org: ${error.message}`);
    console.log(`Updated demo org: ${existing.id}`);
    return existing.id;
  } else {
    const { data, error } = await supabase
      .from("organizations")
      .insert(orgData)
      .select("id")
      .single();
    if (error) throw new Error(`Failed to insert org: ${error.message}`);
    console.log(`Created demo org: ${data.id}`);
    return data.id;
  }
}

async function seedCategories(orgId) {
  const categories = [
    { slug: "bounce-houses", name: "Bounce Houses", sort_order: 1 },
    { slug: "water-slides", name: "Water Slides", sort_order: 2 },
    { slug: "party-packages", name: "Party Packages", sort_order: 3 },
  ];

  const result = {};
  for (const cat of categories) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", cat.slug)
      .maybeSingle();

    if (existing) {
      await supabase.from("categories").update({ name: cat.name, sort_order: cat.sort_order, is_active: true }).eq("id", existing.id);
      result[cat.slug] = existing.id;
    } else {
      const { data, error } = await supabase
        .from("categories")
        .insert({ organization_id: orgId, ...cat, is_active: true, vertical: "inflatable" })
        .select("id")
        .single();
      if (error) throw new Error(`Category ${cat.slug}: ${error.message}`);
      result[cat.slug] = data.id;
    }
  }
  console.log("Seeded 3 categories");
  return result;
}

async function seedProducts(orgId, categoryIds) {
  const products = [
    {
      slug: "rainbow-castle-bounce-house",
      name: "Rainbow Castle Bounce House",
      category_slug: "bounce-houses",
      base_price: 175,
      security_deposit_amount: 50,
      short_description: "A colorful castle-themed bouncer that's perfect for kids ages 3-12.",
      description: "The Rainbow Castle Bounce House is our most popular rental for backyard birthday parties. Featuring vibrant rainbow colors, castle turrets, and a spacious 15x15 ft jumping area, it safely holds up to 8 kids at once. Made from commercial-grade vinyl with reinforced stitching and mesh safety windows so parents can always keep an eye on the fun. Includes stakes, blower, and ground tarp.",
    },
    {
      slug: "tropical-water-slide",
      name: "Tropical Water Slide",
      category_slug: "water-slides",
      base_price: 249,
      security_deposit_amount: 75,
      short_description: "A thrilling 18-foot water slide with tropical palm tree theming.",
      description: "Beat the heat with our Tropical Water Slide! Standing 18 feet tall with a steep, fast slide lane and a refreshing splash pool at the bottom, this unit is the star of every summer party. The tropical palm tree design and bright colors make it a showpiece in any backyard. Suitable for ages 5-15. Requires a garden hose connection and flat surface. Commercial-grade vinyl with safety netting and padded landing zone.",
    },
    {
      slug: "mega-obstacle-course",
      name: "Mega Obstacle Course",
      category_slug: "bounce-houses",
      base_price: 325,
      security_deposit_amount: 100,
      short_description: "A 40-foot dual-lane obstacle course with tunnels, climbers, and slides.",
      description: "The Mega Obstacle Course is the ultimate party centerpiece for school events, church carnivals, and large backyard celebrations. At 40 feet long with dual racing lanes, kids compete through pop-up obstacles, squeeze-through tunnels, a climbing wall, and a thrilling slide finish. Ages 5-16, holds up to 10 participants at once. Perfect for team-building events and field days.",
    },
    {
      slug: "princess-combo-unit",
      name: "Princess Combo Unit",
      category_slug: "bounce-houses",
      base_price: 225,
      security_deposit_amount: 60,
      short_description: "A bounce-and-slide combo with princess castle theming and basketball hoop.",
      description: "The Princess Combo Unit combines a spacious bounce area with a built-in slide and basketball hoop, all wrapped in a beautiful pink and purple castle design. The 4-in-1 design means more fun in less space, making it ideal for smaller yards. Features mesh windows for ventilation and visibility, a safety ramp entrance, and commercial-grade anchoring. Ages 3-10, capacity 6 kids.",
    },
    {
      slug: "sports-arena-bounce-house",
      name: "Sports Arena Bounce House",
      category_slug: "bounce-houses",
      base_price: 185,
      security_deposit_amount: 50,
      short_description: "A sports-themed bouncer with basketball hoop and soccer goal inside.",
      description: "The Sports Arena Bounce House is designed for active kids who love competition. Inside the 15x15 ft jumping area, you will find a basketball hoop and a soft soccer goal. The bold red, blue, and green sports graphics appeal to boys and girls alike. Great for birthday parties, team celebrations, and neighborhood gatherings. Ages 3-12, capacity 8 kids. Includes blower, stakes, and setup.",
    },
    {
      slug: "ultimate-party-package",
      name: "Ultimate Party Package",
      category_slug: "party-packages",
      base_price: 449,
      security_deposit_amount: 125,
      short_description: "Everything you need: bounce house, water slide, tables, chairs, and a popcorn machine.",
      description: "The Ultimate Party Package takes the stress out of party planning. You get our Rainbow Castle Bounce House, the Tropical Water Slide, two 6-ft folding tables, 16 folding chairs, and a commercial popcorn machine with supplies for 50 servings. We deliver everything, set it all up, and pick it up after. Just add guests! Perfect for large backyard parties, graduation celebrations, and community events. Save over $150 compared to booking each item separately.",
    },
  ];

  const result = {};
  for (const prod of products) {
    const categoryId = categoryIds[prod.category_slug];
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", prod.slug)
      .maybeSingle();

    const row = {
      organization_id: orgId,
      category_id: categoryId,
      name: prod.name,
      slug: prod.slug,
      short_description: prod.short_description,
      description: prod.description,
      base_price: prod.base_price,
      security_deposit_amount: prod.security_deposit_amount,
      requires_delivery: true,
      is_active: true,
      visibility: "public",
      pricing_model: "flat_day",
      rental_mode: "catalog_only",
    };

    if (existing) {
      await supabase.from("products").update(row).eq("id", existing.id);
      result[prod.slug] = existing.id;
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(`Product ${prod.slug}: ${error.message}`);
      result[prod.slug] = data.id;
    }
  }
  console.log("Seeded 6 products");
  return result;
}

async function seedAssets(orgId, productIds) {
  const assets = [
    { product_slug: "rainbow-castle-bounce-house", tag: "DEMO-RC-001", serial: "RC2023-001" },
    { product_slug: "rainbow-castle-bounce-house", tag: "DEMO-RC-002", serial: "RC2023-002" },
    { product_slug: "tropical-water-slide", tag: "DEMO-WS-001", serial: "WS2023-001" },
    { product_slug: "mega-obstacle-course", tag: "DEMO-OC-001", serial: "OC2023-001" },
    { product_slug: "princess-combo-unit", tag: "DEMO-PC-001", serial: "PC2023-001" },
    { product_slug: "princess-combo-unit", tag: "DEMO-PC-002", serial: "PC2024-002" },
    { product_slug: "sports-arena-bounce-house", tag: "DEMO-SA-001", serial: "SA2023-001" },
    { product_slug: "ultimate-party-package", tag: "DEMO-UP-001", serial: "UP2024-001" },
  ];

  for (const asset of assets) {
    const productId = productIds[asset.product_slug];
    const { data: existing } = await supabase
      .from("assets")
      .select("id")
      .eq("organization_id", orgId)
      .eq("asset_tag", asset.tag)
      .maybeSingle();

    const row = {
      organization_id: orgId,
      product_id: productId,
      asset_tag: asset.tag,
      serial_number: asset.serial,
      operational_status: "ready",
      condition_status: "good",
    };

    if (existing) {
      await supabase.from("assets").update(row).eq("id", existing.id);
    } else {
      const { error } = await supabase.from("assets").insert(row);
      if (error) throw new Error(`Asset ${asset.tag}: ${error.message}`);
    }
  }
  console.log("Seeded 8 assets");
}

async function seedServiceAreas(orgId) {
  const areas = [
    { label: "Downtown & Central", zip_code: "22401", city: "Fredericksburg", state: "VA", delivery_fee: 0, minimum_order_amount: 150 },
    { label: "Stafford & North", zip_code: "22554", city: "Stafford", state: "VA", delivery_fee: 35, minimum_order_amount: 175 },
  ];

  for (const area of areas) {
    const { data: existing } = await supabase
      .from("service_areas")
      .select("id")
      .eq("organization_id", orgId)
      .eq("zip_code", area.zip_code)
      .maybeSingle();

    const row = { organization_id: orgId, ...area, is_active: true };

    if (existing) {
      await supabase.from("service_areas").update(row).eq("id", existing.id);
    } else {
      const { error } = await supabase.from("service_areas").insert(row);
      if (error) throw new Error(`Service area ${area.zip_code}: ${error.message}`);
    }
  }
  console.log("Seeded 2 service areas");
}

async function seedCustomers(orgId) {
  const customers = [
    { first_name: "Sarah", last_name: "Mitchell", email: "sarah.mitchell@example.com", phone: "(555) 234-5678" },
    { first_name: "David", last_name: "Chen", email: "david.chen@example.com", phone: "(555) 345-6789" },
    { first_name: "Jennifer", last_name: "Torres", email: "jennifer.torres@example.com", phone: "(555) 456-7890" },
    { first_name: "Marcus", last_name: "Williams", email: "marcus.williams@example.com", phone: "(555) 567-8901" },
    { first_name: "Emily", last_name: "Patel", email: "emily.patel@example.com", phone: "(555) 678-9012" },
  ];

  const result = [];
  for (const c of customers) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", c.email)
      .maybeSingle();

    if (existing) {
      await supabase.from("customers").update(c).eq("id", existing.id);
      result.push(existing.id);
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert({ organization_id: orgId, ...c })
        .select("id")
        .single();
      if (error) throw new Error(`Customer ${c.email}: ${error.message}`);
      result.push(data.id);
    }
  }
  console.log("Seeded 5 customers");
  return result;
}

async function seedOrders(orgId, customerIds, productIds) {
  // Build dates relative to today for realism
  const today = new Date();
  const d = (offset) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().split("T")[0];
  };
  const ts = (dateStr, hour) => `${dateStr}T${String(hour).padStart(2, "0")}:00:00`;

  const productSlugs = Object.keys(productIds);
  const orders = [
    { num: "DEMO-1001", status: "completed", cust: 0, prod: "rainbow-castle-bounce-house", date: d(-14), total: 210, deposit: 52.50, balance: 0, notes: "Birthday party for Lily, age 6" },
    { num: "DEMO-1002", status: "completed", cust: 1, prod: "tropical-water-slide", date: d(-7), total: 284, deposit: 71, balance: 0, notes: "Summer block party" },
    { num: "DEMO-1003", status: "delivered", cust: 2, prod: "mega-obstacle-course", date: d(0), total: 360, deposit: 90, balance: 270, notes: "School field day event" },
    { num: "DEMO-1004", status: "scheduled", cust: 3, prod: "princess-combo-unit", date: d(3), total: 260, deposit: 65, balance: 195, notes: "Princess-themed birthday" },
    { num: "DEMO-1005", status: "confirmed", cust: 4, prod: "ultimate-party-package", date: d(7), total: 484, deposit: 121, balance: 363, notes: "Graduation celebration" },
    { num: "DEMO-1006", status: "awaiting_deposit", cust: 0, prod: "sports-arena-bounce-house", date: d(10), total: 220, deposit: 55, balance: 220, notes: "Community fundraiser" },
    { num: "DEMO-1007", status: "cancelled", cust: 1, prod: "rainbow-castle-bounce-house", date: d(5), total: 210, deposit: 52.50, balance: 0, notes: "Customer rescheduled" },
    { num: "DEMO-1008", status: "inquiry", cust: 2, prod: "tropical-water-slide", date: d(14), total: 284, deposit: 71, balance: 284, notes: "Asked about combo discount" },
  ];

  for (const o of orders) {
    const customerId = customerIds[o.cust];
    const productId = productIds[o.prod];

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("organization_id", orgId)
      .eq("order_number", o.num)
      .maybeSingle();

    const basePrice = o.total - 35; // delivery fee = 35
    const row = {
      organization_id: orgId,
      customer_id: customerId,
      order_number: o.num,
      order_status: o.status,
      event_date: o.date,
      event_start_time: ts(o.date, 10),
      event_end_time: ts(o.date, 16),
      subtotal_amount: basePrice,
      delivery_fee_amount: 35,
      total_amount: o.total,
      deposit_due_amount: o.deposit,
      balance_due_amount: o.balance,
      source_channel: "website",
      notes: o.notes,
    };

    let orderId;
    if (existing) {
      await supabase.from("orders").update(row).eq("id", existing.id);
      orderId = existing.id;
      // Clean and re-insert items
      await supabase.from("order_items").delete().eq("order_id", orderId);
    } else {
      const { data, error } = await supabase
        .from("orders")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(`Order ${o.num}: ${error.message}`);
      orderId = data.id;
    }

    // Order item
    await supabase.from("order_items").insert({
      order_id: orderId,
      product_id: productId,
      line_type: "rental",
      quantity: 1,
      unit_price: basePrice,
      line_total: basePrice,
      item_name_snapshot: o.prod.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    });

    // Payments for completed/delivered/scheduled/confirmed orders
    if (["completed", "delivered", "scheduled", "confirmed"].includes(o.status)) {
      // Clear existing demo payments
      await supabase.from("payments").delete().eq("order_id", orderId);

      // Deposit payment
      await supabase.from("payments").insert({
        order_id: orderId,
        provider: "stripe",
        provider_payment_id: `demo_pi_${o.num}_deposit`,
        payment_type: "deposit",
        payment_status: "paid",
        amount: o.deposit,
        paid_at: new Date(new Date(o.date).getTime() - 7 * 86400000).toISOString(),
      });

      // Full payment for completed orders
      if (o.status === "completed") {
        await supabase.from("payments").insert({
          order_id: orderId,
          provider: "cash",
          payment_type: "balance",
          payment_status: "paid",
          amount: o.total - o.deposit,
          paid_at: o.date + "T18:00:00",
        });
      }
    }
  }
  console.log("Seeded 8 orders with payments");
}

async function seedMessages(orgId) {
  // Get first two customers and orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_id, order_number")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
    .limit(3);

  if (!orders || orders.length < 2) return;

  for (const order of orders.slice(0, 2)) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("organization_id", orgId)
      .eq("order_id", order.id)
      .limit(1)
      .maybeSingle();

    if (existing) continue; // Don't duplicate

    // Inbound message from customer
    await supabase.from("messages").insert({
      organization_id: orgId,
      order_id: order.id,
      customer_id: order.customer_id,
      direction: "inbound",
      channel: "portal",
      subject: "Question about setup",
      body: "Hi! I wanted to confirm what time your crew will arrive for setup. Our party starts at 10am and I want to make sure everything is ready. Thanks!",
      read: false,
    });

    // Outbound reply
    await supabase.from("messages").insert({
      organization_id: orgId,
      order_id: order.id,
      customer_id: order.customer_id,
      direction: "outbound",
      channel: "email",
      subject: "Re: Question about setup",
      body: "Hi! We typically arrive 1-2 hours before the event start time, so you can expect us between 8-9am. We will text you when we are on the way!",
      read: true,
    });
  }
  console.log("Seeded demo messages");
}

async function seedNotifications(orgId) {
  // Check if we already have demo notifications
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();

  if (existing) return; // Don't duplicate

  const notifications = [
    { title: "New booking received", body: "Sarah Mitchell booked Rainbow Castle Bounce House for Apr 20", notification_type: "order", read: false },
    { title: "Payment received", body: "$65.00 deposit from Jennifer Torres for order DEMO-1004", notification_type: "payment", read: false },
    { title: "New message", body: "David Chen sent a message about order DEMO-1002", notification_type: "message", read: true },
  ];

  for (const n of notifications) {
    await supabase.from("notifications").insert({
      organization_id: orgId,
      ...n,
    });
  }
  console.log("Seeded 3 notifications");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Seeding demo organization${RESET ? " (with reset)" : ""}...`);

  const orgId = await upsertOrg();
  const categoryIds = await seedCategories(orgId);
  const productIds = await seedProducts(orgId, categoryIds);
  await seedAssets(orgId, productIds);
  await seedServiceAreas(orgId);
  const customerIds = await seedCustomers(orgId);
  await seedOrders(orgId, customerIds, productIds);
  await seedMessages(orgId);
  await seedNotifications(orgId);

  console.log("\nDemo seed complete!");
  console.log(`Organization ID: ${orgId}`);
  console.log(`Storefront URL:  https://demo.korent.app`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

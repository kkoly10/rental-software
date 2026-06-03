export type HelpArticle = {
  slug: string;
  title: string;
  section: string;
  summary: string;
  body: string;
  related: string[];
};

export const helpSections = [
  "Getting Started",
  "Products",
  "Orders",
  "Payments",
  "Documents",
  "Deliveries & Crew",
  "Website",
  "Pricing",
  "Notifications",
  "Customer Portal",
  "Troubleshooting",
] as const;

export const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    slug: "first-steps",
    title: "First steps after signing up",
    section: "Getting Started",
    summary: "What to do right after creating your account and organization.",
    body: `After completing onboarding, your organization is created with starter categories and your primary service area.

**Recommended first steps:**

1. **Complete your business profile** — Go to Settings and add your support email and phone number. This information appears on documents and helps customers reach you.

2. **Add your first product** — Go to Products > Add Product. Enter a name, select a category, set your daily rental price, and write a description. Mark it as Active to show it on your storefront.

3. **Upload product photos** — On any product detail page, use the image manager to upload photos. The first image becomes the primary image shown in the catalog.

4. **Review your service areas** — Check that your delivery zones, fees, and minimum order amounts are correct.

5. **Create a test order** — Walk through the order creation flow to understand how bookings work before going live.

**After setup, explore advanced features:**
- **Dynamic pricing** — Set up weekend surcharges and early bird discounts
- **Brand customization** — Upload your logo and choose brand colors
- **SMS notifications** — Enable text message alerts for customers
- **AI content builder** — Let the Copilot write your storefront content`,
    related: ["adding-products", "service-areas", "creating-orders", "dynamic-pricing", "brand-customization"],
  },
  {
    slug: "understanding-dashboard",
    title: "Understanding your dashboard",
    section: "Getting Started",
    summary: "How to read the main dashboard and what each stat means.",
    body: `Your dashboard shows four key metrics at the top:

- **Today's bookings** — Total active orders in the system
- **Upcoming deliveries** — Orders that need delivery scheduling
- **Active products** — Products visible on your storefront catalog
- **Payment items** — Recent payment activity across all orders

Below the stats, you'll see **Recent orders** on the left (the 3 most recent bookings) and **Quick actions** on the right with shortcuts to common tasks.

**Tip:** The setup checklist appears on the dashboard until you've completed all key steps. Follow it to get fully operational.`,
    related: ["first-steps", "navigating-the-sidebar"],
  },
  {
    slug: "navigating-the-sidebar",
    title: "Navigating the sidebar",
    section: "Getting Started",
    summary: "Quick guide to the main navigation sections.",
    body: `The sidebar navigation includes these sections:

- **Dashboard** — Daily overview with stats and recent orders
- **Orders** — All bookings with weather alerts for event dates
- **Calendar** — Date-based view of upcoming events
- **Products** — Your rental inventory and catalog management
- **Pricing** — Dynamic pricing rules (weekend surcharges, early bird discounts, seasonal rates)
- **Customers** — Customer database with contact info and booking history
- **Payments** — Payment tracking, deposits, and balance management
- **Documents** — Rental agreements and safety waivers
- **Deliveries** — Route planning with interactive map and timeline
- **Maintenance** — Product maintenance scheduling and records
- **Service Areas** — ZIP-code delivery zones with interactive coverage map
- **Analytics** — Revenue trends, conversion rates, and top products
- **Website** — Storefront customization, brand settings, and AI content builder
- **Settings** — Business profile, SMS notifications, timezone, and configuration
- **Crew Mobile** — Mobile-friendly view for field crew

The bottom of the sidebar has links to your **Public Site** (storefront preview) and **Sign Out**.`,
    related: ["understanding-dashboard", "first-steps"],
  },

  // Products
  {
    slug: "adding-products",
    title: "Adding and editing products",
    section: "Products",
    summary: "How to create product listings for your rental inventory.",
    body: `**Adding a new product:**

1. Go to **Products** in the sidebar
2. Click **Add Product**
3. Fill in the required fields:
   - **Name** — What customers see (e.g., "Large Party Tent")
   - **Category** — Select from your categories
   - **Base Price** — Daily rental rate
   - **Description** — Details about the product, dimensions, capacity, etc.
4. Set **Active** status to show it on your storefront
5. Click **Save Product**

**Editing a product:**

Click any product from the list to open its detail page. Update fields and save.

**Tips:**
- Use clear, descriptive names that customers will search for
- Include dimensions, weight limits, and age recommendations in the description
- Set a security deposit amount for high-value items
- Products marked as "Hidden" won't appear on the public catalog`,
    related: ["uploading-images", "product-visibility"],
  },
  {
    slug: "uploading-images",
    title: "Uploading product images",
    section: "Products",
    summary: "How to add and manage photos for your products.",
    body: `Product images make your catalog look professional and help customers choose.

**To upload images:**

1. Go to **Products** and click on a product
2. Scroll to the **Images** section
3. Click **Upload Image** and select a file
4. The image uploads to your storage bucket automatically
5. The first image becomes the primary image shown in catalog cards

**Image tips:**
- Use well-lit photos showing the full product set up
- Include photos from different angles
- Action shots with people using the equipment work great
- Recommended size: at least 800x600 pixels
- Supported formats: JPG, PNG, WebP

**Primary image:** The first uploaded image is used as the main catalog thumbnail. Upload your best photo first.`,
    related: ["adding-products", "product-visibility"],
  },
  {
    slug: "product-visibility",
    title: "Managing product visibility",
    section: "Products",
    summary: "Control which products appear on your public storefront.",
    body: `Products have two visibility states:

- **Active** — Appears on your public storefront catalog and can be booked
- **Hidden** — Not visible to customers, but remains in your inventory

**When to hide a product:**
- Seasonal items not currently available
- Products under maintenance or repair
- Items you want to keep in inventory but not offer yet

**Visibility is separate from deletion.** Hidden products keep their photos, pricing, and booking history intact. You can reactivate them anytime.

Go to the product detail page and toggle the Active/Hidden status to control visibility.`,
    related: ["adding-products", "uploading-images"],
  },

  // Orders
  {
    slug: "creating-orders",
    title: "Creating orders manually",
    section: "Orders",
    summary: "How to create rental bookings from the dashboard.",
    body: `**To create a manual order:**

1. Go to **Orders** > **Create New Order**
2. Select or create a customer
3. Choose the event date
4. Select products for the rental
5. Choose the delivery service area (sets delivery fee automatically)
6. Review the total and submit

**Order statuses:**
- **Inquiry** — Initial contact, not yet confirmed
- **Quote Sent** — Pricing sent to customer
- **Awaiting Deposit** — Waiting for deposit payment
- **Confirmed** — Deposit received, booking confirmed
- **Delivered** — Equipment delivered and set up
- **Completed** — Event done, equipment picked up
- **Cancelled** — Booking cancelled

**Tip:** Orders auto-confirm when they receive full payment. You can also manually advance the status.`,
    related: ["recording-payments", "generating-documents"],
  },
  {
    slug: "order-lifecycle",
    title: "The order lifecycle",
    section: "Orders",
    summary: "Understanding how orders move from inquiry to completion.",
    body: `A typical rental order follows this path:

1. **Customer inquires** — Through your storefront or by phone
2. **You create the order** — Add customer, products, event date
3. **Send a quote** — Review pricing with the customer
4. **Collect deposit** — Record the deposit payment
5. **Order confirms** — Automatically when deposit or full payment is received
6. **Plan delivery** — Assign to a route and crew
7. **Deliver and set up** — Crew delivers and sets up at the venue
8. **Event happens** — Customer enjoys the rental
9. **Pick up** — Crew picks up equipment after the event
10. **Collect balance** — Record any remaining payment
11. **Complete the order** — Close out the booking

Not every order follows every step. Some customers pay in full upfront, some are cash-on-delivery. The system is flexible.`,
    related: ["creating-orders", "recording-payments"],
  },

  // Payments
  {
    slug: "recording-payments",
    title: "Recording payments",
    section: "Payments",
    summary: "How to record deposits, balances, and track payment status.",
    body: `**To record a payment:**

1. Go to **Payments** or open a specific order
2. Select the order you're recording payment for
3. Enter the payment amount
4. Choose the payment method (Cash, Check, Venmo, Zelle, Card, Other)
5. Add an optional reference note (check number, transaction ID, etc.)
6. Click **Record Payment**

**Auto-confirmation:** When total payments meet or exceed the order total, the order status automatically changes to "Confirmed."

**Payment types:**
- **Deposit** — Partial payment to reserve the date
- **Balance** — Remaining amount due before or at delivery
- **Full payment** — Customer pays everything upfront

**Tip:** Keep reference notes for cash and check payments. This helps with reconciliation and dispute resolution.`,
    related: ["creating-orders", "order-lifecycle"],
  },

  // Documents
  {
    slug: "generating-documents",
    title: "Generating documents for orders",
    section: "Documents",
    summary: "How to create rental agreements and safety waivers.",
    body: `**To generate documents:**

1. Go to **Documents** or open a specific order
2. Click **Generate Documents** for the order
3. Two documents are created:
   - **Rental Agreement** — Terms and conditions for the rental
   - **Safety Waiver** — Liability waiver for equipment use

**Document statuses:**
- **Draft** — Generated but not yet sent
- **Sent** — Sent to the customer
- **Signed** — Customer has signed the document

**To update status:**
Use the action buttons next to each document to mark it as "Sent" or "Signed."

**Best practice:** Generate and send documents as soon as a booking is confirmed, well before the event date. This gives customers time to review and sign.`,
    related: ["creating-orders", "recording-payments"],
  },

  // Orders
  {
    slug: "recurring-bookings",
    title: "Setting up a recurring booking",
    section: "Orders",
    summary: "Auto-generate weekly, monthly, or custom-cadence bookings from a single template.",
    body: `For customers who rent on a regular schedule — a Saturday bouncy castle for 8 weeks, or a monthly storage tent — Korent can generate the future bookings for you.

**Create a recurring series:**

1. Open the order you want to use as the template (same customer, address, items)
2. In the action row, click **Make recurring**
3. Pick a **Cadence** — Daily / Weekly / Every 2 weeks / Monthly / Quarterly
4. Set the **multiplier** — "every 2 weeks" = cadence Weekly, multiplier 2
5. Set a stop condition: either an **End date**, a **Max occurrences** count, or leave both blank for "indefinite"
6. Click **Create series**

Korent immediately generates the next ~2 years of bookings (or fewer if a stop condition kicks in earlier). Each child booking gets confirmed automatically and inherits the template's items and pricing.

**Cancel or pause:**

Open any order in the series — the **Recurring series** section at the bottom of the page lets you:
- **Pause** — stop generating new bookings, leave existing ones intact. Use for seasonal pauses.
- **Resume** — re-activate a paused series; catches up missed cycles.
- **Cancel** — stop generation permanently. The checkbox "Also cancel future bookings" cancels child orders whose event date is still in the future. Past bookings are always preserved.

**Edit the cadence:**

Cadence is locked once the series is created. To change it, cancel the series and create a new one. (Editing the cadence on the fly is a planned follow-up.)

**Edit the items:**

Items are copied from the template at series-create time and frozen on each child. Editing the template later does NOT propagate to existing children. Regenerating with new items is also planned.

**Tips:**

- Use **monthly** for long-term equipment rentals (Booqable can't do this — it's a real Korent wedge)
- Use **weekly** for repeat-event customers (every Saturday for the summer)
- The **horizon** is 2 years out. If you set "indefinite," Korent keeps generating new bookings every night as the horizon rolls forward.`,
    related: ["creating-orders", "cancelling-orders"],
  },

  // Notifications
  {
    slug: "whatsapp-notifications",
    title: "Setting up WhatsApp notifications",
    section: "Notifications",
    summary: "Send order, deposit, and delivery updates over WhatsApp — the channel many of your customers actually use.",
    body: `WhatsApp is the default messaging channel in Mexico, much of Latin America, and increasingly in US Hispanic markets. Korent can send order confirmations, deposit reminders, and delivery updates over WhatsApp to customers who opt in — with automatic SMS fallback for everyone else. **No other rental software ships this.**

**External setup (do this before flipping the toggle):**

1. **Twilio account**: open the Twilio Console → Messaging → Try it out → Send a WhatsApp message. Note the sandbox sender (typically <code>+1 415 523 8886</code>) for testing.

2. **Submit templates for Meta approval**. Each notification type needs a pre-approved template. Use Korent's exact wording (we send these to Meta verbatim):

   - Order Confirmation: "Hi from {{1}}! Your booking {{2}} is confirmed. We'll be in touch with delivery details."
   - Deposit Reminder: "Reminder from {{1}}: a {{3}} deposit is due to confirm booking {{2}}."
   - Delivery Scheduled: "{{1}} delivery for {{2}} is scheduled for {{3}}, {{4}}."
   - Delivery En Route: "{{1}} is on the way with your order {{2}}. ETA {{3}}. Track: {{4}}"
   - Delivery Completed: "Your delivery for {{2}} from {{1}} is complete. Thanks for choosing us!"

   Approval is usually minutes for "utility" templates, longer for "marketing".

3. **Add the Twilio Content SIDs** to your deployment as env vars:
   <code>WHATSAPP_TEMPLATE_ORDER_CONFIRMATION</code>, <code>WHATSAPP_TEMPLATE_DEPOSIT_REMINDER</code>, etc. (one per template). Until these are set, the corresponding notification type falls back to SMS even if the channel is enabled.

**Turning it on inside Korent:**

1. Go to **Settings → SMS Notifications**
2. Scroll to the **WhatsApp Business** section
3. Tick **Enable WhatsApp notifications**
4. Paste your Twilio WhatsApp sender number (E.164 format)
5. Save

**Customer opt-in:**

Each customer has a separate "WhatsApp opt-in" flag on their detail page. Set it to ON for customers who've confirmed they want WhatsApp instead of SMS. Customers who haven't opted in keep receiving SMS — no spam risk.

**What happens when something fails:**

If WhatsApp send fails (template not approved, Twilio outage, customer never started a conversation), Korent automatically falls back to SMS. The communication log on the customer page shows which channel actually delivered.

**Tips:**

- Customers in the US who use iPhone Messages often have RCS/iMessage — those land via SMS, which is fine. WhatsApp opt-in is most valuable for international customers and the US Hispanic market.
- Use the Twilio sandbox sender for testing. Production sender approval from Meta takes ~1-2 weeks once your business is verified.`,
    related: ["sms-settings"],
  },

  // Payments
  {
    slug: "xero-sync",
    title: "Connecting Xero",
    section: "Payments",
    summary: "Push paid invoices into Xero — same as QuickBooks, just a different accounting backend.",
    body: `If your accountant uses Xero (especially common for newer or smaller businesses, or operators outside the US), Korent can push paid invoices straight into your Xero file.

**Connect Xero:**

1. **Settings → Integrations**, click **Connect Xero**
2. Sign in to Xero and grant access to the organization you want to sync to
3. If you have multiple Xero organizations, the first one in your list is used (multi-organization chooser is a planned follow-up)
4. You'll land back on Settings with "Xero connected"

**Test it on a real order:**

Same drill as QuickBooks — open a Confirmed or Delivered order and click **Sync to Xero**. Open Xero in another tab and confirm the invoice landed under the contact.

**Auto-sync trigger:**

Orders sync automatically when they move to **Delivered**. Daily reconcile retries failures the next morning.

**Both QuickBooks and Xero connected?**

That's fine. Each integration tracks its own sync state. Every paid order tries both. You won't get duplicate invoices in one accounting system — each provider's sync is independent.

**Tips:**

- Contact matching uses the customer's name (display name in Xero). Two "John Smith" entries will match the first one — rename in Xero to disambiguate.
- Invoices land as **Authorised** status, ready for your accountant to mark paid once the deposit is reconciled.
- Item line descriptions come from Korent's stored item snapshot.`,
    related: ["quickbooks-sync", "recording-payments"],
  },

  {
    slug: "quickbooks-sync",
    title: "Connecting QuickBooks Online",
    section: "Payments",
    summary: "Push your Korent invoices into QuickBooks so your accountant doesn't have to copy them.",
    body: `**What this does:**

Once connected, every order that reaches the **Delivered** status automatically becomes a QuickBooks invoice — with the customer, line items, and delivery fee. Your accountant opens QuickBooks, sees the up-to-date books, and you spend less time copying numbers.

**Connect QuickBooks:**

1. Go to **Settings → Integrations** in the sidebar
2. Click **Connect QuickBooks**
3. Sign in to Intuit and grant access to the company file you want to sync
4. You'll land back on Settings with "QuickBooks connected"

**Test it on a real order:**

Don't trust the auto-sync blind — try it once:
1. Open any **Confirmed** or **Delivered** order
2. Click **Sync to QuickBooks**
3. Open QuickBooks in another tab — the invoice should appear under the customer
4. If anything's off, the "Last sync error" line on the Settings card tells you what happened

**Auto-sync trigger:**

Orders sync automatically when they move to **Delivered**. If a sync fails (network blip, rate limit), the daily reconcile job retries it the next morning.

**Disconnect:**

Settings → Integrations → **Disconnect**. Removes the connection from Korent and revokes the access at Intuit. Your existing QuickBooks invoices stay intact.

**Tips:**

- Customer names: Korent uses the customer's display name to find existing QBO customers. If you have two "John Smith" entries, only the first will be matched. Rename one in QBO if this becomes a problem.
- Already-paid deposits: the QBO invoice is created with the full total. Marking the deposit paid is done inside QBO by your accountant.`,
    related: ["recording-payments", "exporting-payments"],
  },

  // Deliveries & Crew
  {
    slug: "smart-delivery-mode",
    title: "How auto-scheduling (Smart Delivery Mode) works",
    section: "Deliveries & Crew",
    summary: "Why you don't need to create a route by hand for every delivery.",
    body: `Korent's default behavior is **Smart Delivery Mode** — the system auto-creates delivery routes and bundles same-day orders together so you can dispatch with a single click. No more "create route, then add stop, then start route" three-step ritual.

**How it works:**

1. **You confirm an order with a delivery address.** Korent checks if a route already exists for that delivery date.
2. **If no route exists:** Korent creates one named "Deliveries for {date}" with no driver/vehicle assigned (you can fill those in later if you want).
3. **If a route already exists:** Korent adds the new order to it. Stops are auto-sequenced by event time, so the loading order matches your day.
4. **When the crew is ready to roll**, open the order and click **Send delivery**. The stop is marked en-route, the route is marked in-progress, and the customer gets an SMS (if you have SMS turned on).

**What if I have 3 orders for the same Saturday?**

All three land on the same auto-created "Deliveries for Saturday" route, in event-time order. One trip, multiple stops.

**What if I want to drive the route myself?**

Open the route from the Deliveries page. You can drag-reorder stops, assign a driver/vehicle, or even add a manual stop. Nothing is taken away — Smart Delivery Mode just removes the **mandatory** parts.

**What happens if I cancel an order?**

Korent automatically removes that order's stop from its route. If it was the only stop on a planned route, the empty route is cleaned up too.

**Turning it off (manual mode):**

If you prefer to plan routes manually before dispatching, go to **Settings → Smart Delivery Mode** and switch to manual. The classic flow is preserved exactly as it was.`,
    related: ["delivery-routes", "crew-mobile", "pull-sheets"],
  },
  {
    slug: "pull-sheets",
    title: "Printing a pull sheet for a route",
    section: "Deliveries & Crew",
    summary: "Generate a printable load list for your delivery crew.",
    body: `A pull sheet is a printable load list that tells the crew exactly what to load on the truck before leaving the warehouse — and what to drop at each stop once they arrive.

**Two sections in every pull sheet:**

- **Load totals** — aggregated counts across the whole route ("12 round tables, 88 chairs, 1 bounce house"). The crew uses this list to load the truck once.
- **Stop-by-stop** — each delivery stop shows the customer, address, time window, and the specific items destined for that stop. Used at the venue to confirm what to drop.

Pickup stops are intentionally excluded from the pull sheet since they're picked up at the end of the day, not loaded at the start.

**How to print a pull sheet:**

1. Go to **Deliveries** in the sidebar
2. On any route card, click **Pull sheet** — or open the route detail page and click **Pull sheet** in the actions area
3. Review the on-screen view
4. Click **Download PDF** to save or print

**Tip:** Print one copy per truck. The PDF includes checkboxes next to each item so the crew can tick items off as they load.`,
    related: ["delivery-routes", "crew-mobile"],
  },
  {
    slug: "delivery-routes",
    title: "Planning delivery routes",
    section: "Deliveries & Crew",
    summary: "How to organize deliveries and manage routes.",
    body: `**Delivery planning:**

The Deliveries page shows your delivery board with routes organized by status, an interactive route map, and a stats bar. Each route represents a group of deliveries for a specific date or area.

**Route statuses:**
- **Planned** — Route created, stops assigned
- **In Progress** — Crew is actively delivering
- **Completed** — All stops done

**Stop statuses:**
- **Scheduled** — Ready for delivery
- **En Route** — Crew is heading to this stop
- **Arrived** — Crew arrived at the venue
- **Setup Complete** — Equipment delivered and set up
- **Picked Up** — Equipment retrieved after event

**Crew Mobile:** Field crew can use the Crew Mobile page (/crew/today) to see their stops and update status in real time from their phones.

**Visual route planner:** The delivery board includes an interactive map showing stops as numbered markers with connecting route lines. See the "Using the visual route planner" article for details.`,
    related: ["crew-mobile", "creating-orders", "visual-route-planner"],
  },
  {
    slug: "crew-mobile",
    title: "Using the Crew Mobile view",
    section: "Deliveries & Crew",
    summary: "The mobile interface for field delivery crew.",
    body: `The Crew Mobile page is designed for field crew using their phones during deliveries.

**Access:** Click "Crew Mobile" in the sidebar, or navigate to /crew/today.

**Features:**
- See today's delivery stops
- Update stop status (En Route, Arrived, Setup Complete, Picked Up)
- View delivery details and customer info
- Optimized for mobile screens

**How it works:** When a crew member updates a stop status, it's reflected in the main dashboard immediately. When all stops on a route are completed, the route automatically marks as complete.

**Tip:** Share the Crew Mobile link with your delivery team. They don't need full dashboard access to update their stops.`,
    related: ["delivery-routes"],
  },

  // Website
  {
    slug: "customizing-storefront",
    title: "Customizing your storefront",
    section: "Website",
    summary: "How to personalize your public booking website.",
    body: `Your public storefront is a fully functional booking website that customers see when they visit your site.

**To customize:**

1. Go to **Website** in the sidebar
2. Edit your **Hero Message** — The main headline visitors see first
3. Set your **Service Area Text** — Describe where you deliver
4. Add a **Booking Message** — Shown during checkout

**Storefront features:**
- Hero section with your custom message
- Category grid showing your product types
- How-it-works section explaining the rental process
- Service area information with interactive delivery map
- Featured inventory from your active products
- Full product catalog with search and filtering
- Product detail pages with image galleries
- Checkout flow with date, ZIP code selection, and weather forecasts
- Customer self-service portal for order tracking and document signing

**New features:**
- **Navigation links** — Choose which nav links appear on your storefront and rename them (see "Customizing navigation links")
- **Brand customization** — Upload your logo, set custom colors and fonts (see "Customizing your brand")
- **AI content writing** — Let the Copilot write your hero headline, FAQs, and more (see "Using AI to write storefront content")
- **Interactive map** — Your delivery coverage areas shown on a real map (see "Interactive service area map")

**Tip:** Preview your storefront by clicking "Public Site" in the sidebar. This shows exactly what customers see.`,
    related: ["managing-service-areas", "adding-products", "nav-links", "brand-customization", "ai-storefront-builder", "service-area-map"],
  },
  {
    slug: "managing-service-areas",
    title: "Managing service areas",
    section: "Website",
    summary: "Setting up delivery zones, fees, and minimum orders.",
    body: `Service areas define where you deliver and what you charge for delivery.

**To manage service areas:**

1. Go to **Service Areas** in the sidebar
2. Each area has:
   - **Label** — Friendly name (e.g., "Stafford Area")
   - **ZIP Code** — The ZIP code covered
   - **Delivery Fee** — What you charge for delivery
   - **Minimum Order** — Minimum rental amount required

**How service areas work:**
- Customers select their ZIP code during booking
- The system matches their ZIP to a service area
- Delivery fee and minimum order are applied automatically
- If no match is found, the customer is told you don't deliver to that area

**Tip:** Start with your primary service area and expand as your business grows. Higher delivery fees for distant areas help cover fuel and time costs.`,
    related: ["customizing-storefront", "first-steps"],
  },

  // Website — new features
  {
    slug: "brand-customization",
    title: "Customizing your brand (logo, colors, fonts)",
    section: "Website",
    summary: "How to upload your logo and set custom brand colors and fonts.",
    body: `Your storefront can be fully branded with your business identity.

**To customize your brand:**

1. Go to **Website** in the sidebar
2. Scroll to the **Brand & Appearance** section
3. Configure:
   - **Logo URL** — Paste a link to your logo image (hosted on your own site, Google Drive, or any image host). Recommended: 200x60px, PNG or SVG.
   - **Primary Color** — Your main brand color. Used for buttons, links, and accents throughout the storefront and dashboard.
   - **Accent Color** — Secondary color for highlights, success states, and badges.
   - **Font Family** — Choose from System Default, Inter, Poppins, Montserrat, Playfair Display, or Roboto.

**Live preview:** Changes preview in real-time on the form before you save. Colors and fonts apply to both your public storefront and dashboard after saving.

**Tip:** Use your business's existing brand colors for consistency. If you're unsure, start with the defaults and refine later.`,
    related: ["customizing-storefront", "ai-storefront-builder"],
  },
  {
    slug: "ai-storefront-builder",
    title: "Using AI to write storefront content",
    section: "Website",
    summary: "Let the Copilot write and edit your website content with one click.",
    body: `The Operator Copilot can now write and update your storefront content directly.

**How to use it:**

1. Go to **Website** in the sidebar
2. Click the **Copilot** button (bottom-right corner)
3. Ask it to write content:
   - "Write a catchy hero headline for my rental business"
   - "Generate a FAQ about rental safety"
   - "Improve my service area description"
   - "Create an about section for my business"

**How it works:**
- The Copilot generates content and shows a preview
- Click **Apply Changes** to save it to your website settings
- Click **Dismiss** to reject and try again
- You can ask for revisions: "Make it shorter" or "Add more enthusiasm"

**Editable fields:**
- Hero message (main headline)
- Service area text
- Booking/checkout message
- FAQ entries
- About section

**Tip:** The Copilot is AI-powered so results may vary. Always review the preview before applying. You can edit the generated content manually afterward from the Website settings page.`,
    related: ["customizing-storefront", "brand-customization"],
  },
  {
    slug: "service-area-map",
    title: "Interactive service area map",
    section: "Website",
    summary: "How the delivery coverage map works for you and your customers.",
    body: `Your storefront and dashboard now include an interactive map showing your delivery coverage areas.

**Public storefront map:**
- Appears in the Service Areas section of your homepage
- Shows markers for each active service area
- Customers can click markers to see delivery fees and minimum order amounts
- Helps customers quickly see if you deliver to their area

**Dashboard map:**
- Visible on the **Service Areas** page in interactive mode
- Shows all your configured service areas as map markers
- Click the map to see coordinates (useful for verifying coverage)

**How it works:**
- The map uses your service area ZIP codes to place markers on the map
- ZIP codes are automatically geocoded (converted to map coordinates)
- No setup required — it works automatically with your existing service areas

**Tip:** Add more service areas with specific ZIP codes for more precise map coverage. Areas with city/state-only entries are geocoded less precisely.`,
    related: ["managing-service-areas", "customizing-storefront"],
  },

  {
    slug: "nav-links",
    title: "Customizing navigation links",
    section: "Website",
    summary: "How to show, hide, and rename the links in your storefront navigation bar.",
    body: `Your storefront navigation bar shows links like Catalog, How It Works, Service Area, Pricing, Order Status, and Contact. You can control which links appear and change their labels.

**To customize navigation links:**

1. Go to **Website** in the sidebar
2. Scroll to the **Navigation Links** panel (under Layout)
3. For each link you can:
   - **Toggle visibility** — Turn the switch off to hide the link from both desktop and mobile navigation
   - **Rename the label** — Click the label field and type a new name (max 30 characters). For example, rename "Catalog" to "Our Rentals" or "Contact" to "Get a Quote"
4. Click **Save Navigation**

**How it works:**
- Changes apply to both the desktop nav bar and the mobile hamburger menu
- The link destinations (URLs) stay the same — only visibility and labels change
- If you haven't customised anything, all six default links are shown

**Tips:**
- Hide "How It Works" or "Service Area" if you've also hidden those homepage sections in Section Visibility — otherwise the nav link scrolls to nothing
- Keep labels short so they fit well on mobile screens
- The "Catalog" and "Contact" links are the most commonly kept by operators`,
    related: ["customizing-storefront", "brand-customization"],
  },

  // Pricing
  {
    slug: "dynamic-pricing",
    title: "Setting up dynamic pricing rules",
    section: "Pricing",
    summary: "How to create automated price adjustments for weekends, seasons, and more.",
    body: `Dynamic pricing lets you automatically adjust rental prices based on conditions like day of week, season, or booking timing.

**To set up pricing rules:**

1. Go to **Pricing** in the sidebar
2. Click **Add Rule** to create a new pricing rule
3. Configure the rule:
   - **Name** — A friendly label (e.g., "Weekend Surcharge")
   - **Type** — Choose from: Weekend, Holiday, Peak Season, Early Bird, Last Minute, Multi-day
   - **Adjustment** — Percentage to add or subtract (positive = surcharge, negative = discount)
   - **Conditions** — Varies by type (days of week, date ranges, booking lead time, etc.)
4. Toggle rules **Active** or **Inactive**
5. Click **Save All Rules**

**Rule types explained:**
- **Weekend** — Applies to specific days of the week (e.g., Saturday/Sunday +15%)
- **Holiday** — Applies during specific date ranges (e.g., July 1-7 +20%)
- **Peak Season** — Same as holiday but for longer seasonal periods
- **Early Bird** — Discount for bookings made far in advance (e.g., 14+ days ahead -10%)
- **Last Minute** — Surcharge or discount for last-minute bookings
- **Multi-day** — Discount for multi-day rentals

**Pricing preview:** Use the calculator on the right side of the page to test how rules affect pricing for a specific date.

**Tip:** Start with a simple weekend surcharge and an early bird discount. These are the most common rules in the rental industry.`,
    related: ["adding-products", "creating-orders"],
  },

  // Notifications
  {
    slug: "sms-notifications",
    title: "Setting up SMS notifications",
    section: "Notifications",
    summary: "How to configure text message alerts for your customers.",
    body: `SMS notifications let you send automated text messages to customers at key moments in their rental journey.

**To set up SMS:**

1. Go to **Settings** in the sidebar
2. Scroll to the **SMS Notifications** section
3. Toggle **Enable SMS notifications** on
4. Choose which notification types to enable:
   - **Order confirmations** — When a booking is confirmed
   - **Deposit reminders** — When a deposit is due
   - **Delivery updates** — When delivery is scheduled, en route, or completed
   - **Payment confirmations** — When a payment is received
   - **Weather alerts** — When weather concerns are detected for an event date
5. Set a **SMS signature** (optional) — Appears at the end of every message
6. Click **Save SMS Settings**

**Requirements:**
SMS notifications require a Twilio account. You'll need to set three environment variables:
- \`TWILIO_ACCOUNT_SID\` — Your Twilio account SID
- \`TWILIO_AUTH_TOKEN\` — Your Twilio auth token
- \`TWILIO_PHONE_NUMBER\` — Your Twilio phone number

**Without Twilio:** SMS notifications work in demo mode (messages are logged but not sent). This is useful for testing the configuration.

**Tip:** Enable order confirmations and delivery updates first — these are the messages customers value most.`,
    related: ["creating-orders", "delivery-routes"],
  },

  // Customer Portal
  {
    slug: "customer-portal",
    title: "Customer self-service portal",
    section: "Customer Portal",
    summary: "How customers can check order status, sign documents, and contact you.",
    body: `Your customers have access to a self-service portal where they can manage their rental bookings.

**Portal URL:** \`/order-status\` — accessible from your public website.

**Portal features:**

1. **Order lookup** — Customers enter their order number and email to view their booking
2. **Order timeline** — Visual progress tracker showing where their order is in the lifecycle (Inquiry → Confirmed → Scheduled → Delivering → Delivered → Completed)
3. **Delivery tracking** — When their order is scheduled or out for delivery, customers see the delivery date and time window
4. **Document signing** — Customers can review and digitally sign rental agreements and safety waivers right from the portal
5. **Invoice download** — One-click PDF invoice download
6. **Contact form** — Customers can send messages (questions, reschedule requests, cancellation requests) directly to your support email

**Document signing:**
- Customers see pending documents with an "Accept & Sign" button
- They enter their full name and check an agreement box
- The document status updates to "signed" automatically
- You can see signed documents in the Documents section of your dashboard

**Tip:** Include the portal link (\`/order-status\`) in your confirmation emails so customers can easily check their booking status and sign documents.`,
    related: ["generating-documents", "order-lifecycle"],
  },

  // Weather
  {
    slug: "weather-alerts",
    title: "Weather-aware booking alerts",
    section: "Orders",
    summary: "How weather forecasts help you and your customers plan for event day.",
    body: `Korent automatically checks weather forecasts for upcoming event dates and shows risk alerts throughout the platform.

**Where weather appears:**

1. **Order detail page** — Full weather alert banner with temperature, wind speed, and precipitation chance
2. **Orders list** — Small weather badge next to each order's date
3. **Checkout** — Customers see weather info when selecting their event date and entering their ZIP code
4. **Customer portal** — Weather note on the order status page

**Risk levels:**
- **Low (green)** — Clear skies, light wind. Great day for an event!
- **Moderate (yellow)** — Some rain possible or moderate wind (15-25 mph). Consider backup plans
- **High (red)** — Storms, heavy rain, or high wind (>25 mph). Consider rescheduling

**How it works:**
- Weather data comes from Open-Meteo (free, no API key needed)
- Forecasts are available for dates up to 16 days out
- Data updates every 30 minutes
- Uses the delivery ZIP code to get location-specific forecasts

**Tip:** When you see a high-risk weather alert, proactively reach out to the customer about backup plans. This builds trust and shows you care about their event's success.`,
    related: ["creating-orders", "order-lifecycle"],
  },

  // Deliveries — new features
  {
    slug: "visual-route-planner",
    title: "Using the visual route planner",
    section: "Deliveries & Crew",
    summary: "How to view delivery routes on an interactive map.",
    body: `The delivery board now includes an interactive map and timeline view for your routes.

**Map view:**
- The right side of the delivery board shows a live map of today's primary route
- Each stop appears as a numbered marker on the map
- Markers are color-coded: blue (assigned), orange (en route/in progress), green (completed)
- Lines connect stops in sequence order
- Click any marker to see customer name, address, and scheduled time

**Stats bar:**
- Shows at a glance: total stops, completed, in progress, and next delivery time
- Progress bar fills as stops are completed

**Route detail page:**
- Click "Open route" on any route card to see its full detail
- Full-width map with all stops
- Vertical timeline showing the stop sequence with status dots
- Each stop card shows: customer name, address, time window, delivery/pickup type, and status

**Tip:** The map works best when your orders have delivery addresses with ZIP codes. The system geocodes addresses to place them on the map.`,
    related: ["delivery-routes", "crew-mobile"],
  },

  // Troubleshooting
  {
    slug: "order-not-confirming",
    title: "Why isn't my order confirming?",
    section: "Troubleshooting",
    summary: "Common reasons an order stays in pending status.",
    body: `Orders auto-confirm when they receive full payment. If an order isn't confirming:

**Check these things:**

1. **Payment amount** — Make sure the total payments equal or exceed the order total. Partial deposits don't auto-confirm unless they cover the full amount.

2. **Payment recorded correctly** — Go to the order detail page and verify the payment was recorded against the right order.

3. **Order status** — Some statuses (like "Cancelled") can't transition to "Confirmed." Check the current status.

**Manual confirmation:** You can always update the order status manually from the order detail page if auto-confirmation isn't triggering.

**Still stuck?** Check the Payments page to verify the payment record exists and is associated with the correct order.`,
    related: ["recording-payments", "order-lifecycle"],
  },
  {
    slug: "images-not-showing",
    title: "Product images not appearing",
    section: "Troubleshooting",
    summary: "What to do when product photos don't show up.",
    body: `If product images aren't appearing on your storefront or dashboard:

**Check these things:**

1. **Upload status** — Go to the product detail page and check if images appear in the image manager. If they show there but not on the storefront, it may be a caching issue.

2. **Storage bucket** — Make sure your Supabase storage bucket "product-images" is configured correctly. The bucket needs to allow public reads.

3. **File format** — Supported formats are JPG, PNG, and WebP. Other formats may not display correctly.

4. **File size** — Very large files (over 5MB) may fail to upload. Try resizing the image.

**Quick fix:** Try uploading a new image. If the new image appears but old ones don't, the old files may have been removed from storage.`,
    related: ["uploading-images", "customizing-storefront"],
  },
  {
    slug: "getting-more-help",
    title: "Getting more help",
    section: "Troubleshooting",
    summary: "Where to go when you need additional support.",
    body: `**Self-service options:**

- **Help Center** — You're here! Browse articles by section or search for specific topics.
- **Copilot** — Click the assistant button (bottom-right of any dashboard page) to ask questions about workflows, features, and next steps.
- **Setup Checklist** — The dashboard checklist walks you through essential setup steps.
- **Guided Tour** — Replay the tour anytime from the Help Center to refresh your memory.

**Tips for getting unstuck:**
- Check the relevant Help Center article for your current page
- Ask the Copilot specific questions about what you're trying to do
- Review the setup checklist to make sure nothing was missed
- Try the "Explain this page" prompt in the Copilot for context-specific help`,
    related: ["first-steps", "understanding-dashboard"],
  },
];

export function getArticlesBySection(section: string): HelpArticle[] {
  return helpArticles.filter((a) => a.section === section);
}

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return helpArticles.find((a) => a.slug === slug);
}

export function searchArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase().trim();
  if (!q) return helpArticles;

  // Match every whitespace-separated token against any indexed field so
  // multi-word natural-language queries hit the right article instead of
  // requiring an exact full-phrase substring.
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) tokens.push(q);

  return helpArticles.filter((a) => {
    const haystack = [a.title, a.summary, a.body, a.section]
      .join(" ")
      .toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
}

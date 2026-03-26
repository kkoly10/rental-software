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
  "Troubleshooting",
] as const;

export const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    slug: "first-steps",
    title: "First steps after signing up",
    section: "Getting Started",
    summary: "What to do right after creating your account and organization.",
    body: `After completing onboarding, your organization is created with starter categories (Bounce Houses, Water Slides, Combos, Obstacle Courses, and Add-ons) and your primary service area.

**Recommended first steps:**

1. **Complete your business profile** — Go to Settings and add your support email and phone number. This information appears on documents and helps customers reach you.

2. **Add your first product** — Go to Products > Add Product. Enter a name, select a category, set your daily rental price, and write a description. Mark it as Active to show it on your storefront.

3. **Upload product photos** — On any product detail page, use the image manager to upload photos. The first image becomes the primary image shown in the catalog.

4. **Review your service areas** — Check that your delivery zones, fees, and minimum order amounts are correct.

5. **Create a test order** — Walk through the order creation flow to understand how bookings work before going live.`,
    related: ["adding-products", "service-areas", "creating-orders"],
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
- **Orders** — All bookings: inquiries, quotes, confirmed, delivered, completed
- **Calendar** — Date-based view of upcoming events
- **Products** — Your inflatable inventory and catalog management
- **Customers** — Customer database with contact info and booking history
- **Payments** — Payment tracking, deposits, and balance management
- **Documents** — Rental agreements and safety waivers
- **Deliveries** — Route planning and delivery board
- **Maintenance** — Product maintenance scheduling and records
- **Service Areas** — ZIP-code delivery zones with fees and minimums
- **Website** — Storefront customization and settings
- **Settings** — Business profile, timezone, and configuration
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
   - **Name** — What customers see (e.g., "Rainbow Bounce House")
   - **Category** — Select from your categories (Bounce Houses, Water Slides, etc.)
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
- Use well-lit photos showing the full inflatable set up
- Include photos from different angles
- Action shots with people using the inflatables work great
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
   - **Safety Waiver** — Liability waiver for inflatable use

**Document statuses:**
- **Draft** — Generated but not yet sent
- **Sent** — Sent to the customer
- **Signed** — Customer has signed the document

**To update status:**
Use the action buttons next to each document to mark it as "Sent" or "Signed."

**Best practice:** Generate and send documents as soon as a booking is confirmed, well before the event date. This gives customers time to review and sign.`,
    related: ["creating-orders", "recording-payments"],
  },

  // Deliveries & Crew
  {
    slug: "delivery-routes",
    title: "Planning delivery routes",
    section: "Deliveries & Crew",
    summary: "How to organize deliveries and manage routes.",
    body: `**Delivery planning:**

The Deliveries page shows your delivery board with routes organized by status. Each route represents a group of deliveries for a specific date or area.

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

**Crew Mobile:** Field crew can use the Crew Mobile page (/crew/today) to see their stops and update status in real time from their phones.`,
    related: ["crew-mobile", "creating-orders"],
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
- Service area information
- Featured inventory from your active products
- Full product catalog with search and filtering
- Product detail pages with image galleries
- Checkout flow with date and ZIP code selection

**Tip:** Preview your storefront by clicking "Public Site" in the sidebar. This shows exactly what customers see.`,
    related: ["managing-service-areas", "adding-products"],
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

  return helpArticles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      a.section.toLowerCase().includes(q)
  );
}

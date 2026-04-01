export type SuggestedPrompt = {
  label: string;
  prompt: string;
};

const globalPrompts: SuggestedPrompt[] = [
  { label: "Help me get set up", prompt: "Help me get set up. What should I do first?" },
  { label: "What should I do next?", prompt: "What should I do next based on my current setup progress?" },
  { label: "Explain this page", prompt: "Explain what this page is for and what I can do here." },
  { label: "How do I prepare for launch?", prompt: "What do I need to do before I'm ready to take real bookings?" },
];

const routePrompts: Record<string, SuggestedPrompt[]> = {
  "/dashboard": [
    { label: "Explain the dashboard stats", prompt: "What do the dashboard stats mean?" },
    { label: "How do I get my first booking?", prompt: "How do I get my first customer booking?" },
  ],
  "/dashboard/products": [
    { label: "How do I add a product?", prompt: "How do I add a new product to my catalog?" },
    { label: "What makes a good listing?", prompt: "What should I include in a product listing to get more bookings?" },
  ],
  "/dashboard/orders": [
    { label: "How do I create an order?", prompt: "Walk me through creating a manual order." },
    { label: "Order statuses explained", prompt: "Explain the different order statuses and what they mean." },
  ],
  "/dashboard/payments": [
    { label: "How do I record a payment?", prompt: "How do I record a payment for an order?" },
    { label: "Why isn't my order confirming?", prompt: "Why is my order not automatically confirming after payment?" },
  ],
  "/dashboard/documents": [
    { label: "How do I generate documents?", prompt: "How do I generate documents for an order?" },
    { label: "What documents are created?", prompt: "What types of documents does Korent create?" },
  ],
  "/dashboard/deliveries": [
    { label: "How do routes work?", prompt: "How do delivery routes and stops work?" },
    { label: "How does the route map work?", prompt: "How does the interactive route map and timeline work?" },
    { label: "What about crew mobile?", prompt: "How does the crew mobile view work for field delivery team?" },
  ],
  "/dashboard/website": [
    { label: "Write a catchy hero headline", prompt: "Write a catchy hero headline for my rental business" },
    { label: "Generate a safety FAQ", prompt: "Generate a FAQ about bounce house safety" },
    { label: "Improve my service area description", prompt: "Improve my service area description" },
    { label: "Create an about section", prompt: "Create an about section for my business" },
    { label: "How do I customize my site?", prompt: "How do I customize my public storefront?" },
    { label: "What do customers see?", prompt: "What does my public storefront look like to customers?" },
  ],
  "/dashboard/settings": [
    { label: "What should I set up here?", prompt: "What settings should I fill in first?" },
    { label: "How do SMS notifications work?", prompt: "How do I set up SMS text message notifications for my customers?" },
  ],
  "/dashboard/pricing": [
    { label: "How does dynamic pricing work?", prompt: "How does dynamic pricing work and what rules should I set up?" },
    { label: "Set up weekend pricing", prompt: "Help me set up a weekend surcharge for my rental business." },
    { label: "What's an early bird discount?", prompt: "What is an early bird discount and how do I configure one?" },
  ],
  "/dashboard/service-areas": [
    { label: "How does the map work?", prompt: "How does the interactive service area map work?" },
    { label: "How do I add a delivery zone?", prompt: "How do I add a new delivery zone with ZIP codes?" },
  ],
};

export function getSuggestedPrompts(route: string): SuggestedPrompt[] {
  const specific = routePrompts[route] ?? [];
  // Return route-specific prompts first, then global ones, up to 4 total
  return [...specific, ...globalPrompts].slice(0, 4);
}

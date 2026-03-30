import { getSiteBaseUrl, getCanonicalUrl } from "./metadata";

export function organizationJsonLd(settings: {
  businessName: string;
  supportEmail: string;
  phone: string;
  serviceAreaLabel: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.businessName,
    description: `Inflatable rental business serving ${settings.serviceAreaLabel}. Bounce houses, water slides, obstacle courses, and party packages.`,
    url: getSiteBaseUrl(),
    telephone: settings.phone,
    email: settings.supportEmail,
    areaServed: settings.serviceAreaLabel,
    priceRange: "$$",
    sameAs: [],
  };
}

export function productJsonLd(product: {
  name: string;
  slug: string;
  description: string;
  price: string;
  category: string;
  imageUrl?: string;
  status: string;
}) {
  const priceNum = product.price.replace(/[^0-9.]/g, "");

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: getCanonicalUrl(`/inventory/${product.slug}`),
    image: product.imageUrl || undefined,
    category: product.category,
    offers: {
      "@type": "Offer",
      price: priceNum || "0",
      priceCurrency: "USD",
      availability:
        product.status === "Available"
          ? "https://schema.org/InStock"
          : product.status === "Limited"
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/OutOfStock",
      url: getCanonicalUrl(`/inventory/${product.slug}`),
    },
  };
}

export function faqJsonLd(
  items: { question: string; answer: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

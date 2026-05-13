import { getSiteBaseUrl, getCanonicalUrl } from "./metadata";

export function organizationJsonLd(
  settings: {
    businessName: string;
    supportEmail: string;
    phone: string;
    serviceAreaLabel: string;
    websiteMessage?: string;
  },
  origin?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.businessName,
    ...(settings.websiteMessage ? { description: settings.websiteMessage } : {}),
    url: origin ?? getSiteBaseUrl(),
    telephone: settings.phone || undefined,
    email: settings.supportEmail || undefined,
    areaServed: settings.serviceAreaLabel,
    priceRange: "$$",
    sameAs: [],
  };
}

export function productJsonLd(
  product: {
    name: string;
    slug: string;
    description: string;
    price: string;
    category: string;
    imageUrl?: string;
    status: string;
  },
  origin?: string
) {
  const priceNum = product.price.replace(/[^0-9.]/g, "");
  const productUrl = getCanonicalUrl(`/inventory/${product.slug}`, origin);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: productUrl,
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
      url: productUrl,
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

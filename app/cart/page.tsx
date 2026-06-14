import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { CartView } from "@/components/public/cart-view";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return await buildPageMetadata({
    title: "Your cart",
    description: "Review the rentals in your cart.",
    path: "/cart",
  });
}

export default async function CartPage() {
  await requirePublicOrg();

  return (
    <>
      <PublicHeader />
      <main id="main">
        <CartView />
      </main>
      <PublicFooter />
    </>
  );
}

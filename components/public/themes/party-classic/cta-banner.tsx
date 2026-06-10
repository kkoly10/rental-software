import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

export async function PartyClassicCtaBanner() {
  const m = await getMessages();
  return (
    <section className="st-cta-banner-wrap">
      <div className="st-container">
        <div className="st-cta-banner">
          <div>
            <h2 className="st-cta-banner-title">Ready to book your event?</h2>
            <p className="st-cta-banner-sub">
              {m.storefront.hero.checkAvailability} — it only takes a minute.
            </p>
          </div>
          <Link href="/inventory" className="st-cta-banner-btn">
            {m.storefront.hero.checkAvailability}
          </Link>
        </div>
      </div>
    </section>
  );
}

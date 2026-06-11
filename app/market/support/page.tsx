import Link from "next/link";
import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupportForm } from "@/components/market/support-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support" };

export default async function MarketSupportPage() {
  let email: string | undefined;
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? undefined;
  }

  return (
    <main className="mk-wrap" style={{ maxWidth: 520 }}>
      <h1>Support</h1>
      <p className="mk-sub">
        Booking-blocking issues are prioritized. For problems with an active
        rental, the fastest path is usually the booking itself — message the
        other party from <Link href="/market/messages">Messages</Link> or open
        a dispute from <Link href="/market/rentals">My rentals</Link>. For
        everything else, write to us here.
      </p>
      <div className="mk-panel">
        <SupportForm defaultEmail={email} />
      </div>
    </main>
  );
}

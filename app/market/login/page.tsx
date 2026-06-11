import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MarketLoginForm } from "@/components/market/login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

/**
 * Dedicated marketplace sign-in — renters never see the operator-
 * branded /login. One account works on both surfaces; this page only
 * changes where you land afterwards.
 */
export default async function MarketLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  const target =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/market/rentals";

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(target);
  }

  return (
    <main className="mk-wrap" style={{ maxWidth: 440 }}>
      <h1>Sign in</h1>
      <p className="mk-sub">
        One account for renting and selling. New here?{" "}
        <Link href="/market/join">Create a free renter account</Link> or{" "}
        <Link href="/market/sell">become a seller</Link>.
      </p>
      <div className="mk-panel">
        <MarketLoginForm redirectTo={target} />
      </div>
    </main>
  );
}

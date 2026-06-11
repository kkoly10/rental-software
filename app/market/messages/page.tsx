import Link from "next/link";
import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messages" };

type ConversationRow = {
  id: string;
  phase: string;
  updated_at: string;
  market_listings: { title: string } | null;
};

/** Inbox — both parties see their threads via the same RLS policy. */
export default async function MessagesInboxPage() {
  let conversations: ConversationRow[] = [];
  let signedIn = false;

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
    if (user) {
      const { data } = await supabase
        .from("market_conversations")
        .select("id, phase, updated_at, market_listings ( title )")
        .order("updated_at", { ascending: false })
        .limit(50);
      conversations = (data as unknown as ConversationRow[] | null) ?? [];
    }
  }

  if (!signedIn) {
    return (
      <main className="mk-wrap">
        <h1>Messages</h1>
        <a className="mk-btn" href={`/market/login?redirect=${encodeURIComponent("/market/messages")}`}>
          Sign in
        </a>
      </main>
    );
  }

  return (
    <main className="mk-wrap" style={{ maxWidth: 720 }}>
      <h1>Messages</h1>
      <p className="mk-sub">One thread per listing — inquiry, booking and support stay together.</p>
      {conversations.length === 0 ? (
        <div className="mk-panel">
          <b>No conversations yet.</b>
          <p className="mk-sub" style={{ margin: "8px 0 0" }}>
            Message a seller from any listing page.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {conversations.map((c) => (
            <Link key={c.id} href={`/market/messages/${c.id}`} className="mk-panel" style={{ textDecoration: "none", color: "inherit" }}>
              <b>{c.market_listings?.title ?? "Listing"}</b>
              <div className="mk-card-m">
                {c.phase === "coordination" ? "✓ booking confirmed" : "inquiry"} ·{" "}
                {new Date(c.updated_at).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

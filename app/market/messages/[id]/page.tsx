import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MessageForm } from "@/components/market/message-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversation" };

type MessageRow = {
  id: string;
  sender_party: string;
  body: string;
  moderation: string;
  created_at: string;
};

/**
 * One continuous thread (§18). Reads via the party RLS policy — a
 * non-party gets zero rows and a 404, no admin client in the render.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasSupabaseEnv()) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: conversation } = await supabase
    .from("market_conversations")
    .select("id, phase, renter_profile_id, market_listings ( id, title )")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("market_messages")
    .select("id, sender_party, body, moderation, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  const listing = conversation.market_listings as unknown as {
    id: string;
    title: string;
  } | null;
  const viewerIsRenter = conversation.renter_profile_id === user.id;

  return (
    <main className="mk-wrap" style={{ maxWidth: 720 }}>
      <div className="mk-crumb">
        <Link href="/market/messages">Messages</Link> · <b>{listing?.title ?? "Listing"}</b>
      </div>
      <h1 style={{ fontSize: 22 }}>{listing?.title ?? "Conversation"}</h1>
      <p className="mk-sub">
        {conversation.phase === "coordination"
          ? "Booking confirmed — coordination is open."
          : "Pre-booking inquiry — contact details unlock after a confirmed booking."}
        {listing ? (
          <>
            {" "}
            · <Link href={`/market/listing/${listing.id}`}>view listing</Link>
          </>
        ) : null}
      </p>

      <div className="mk-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(messages ?? []).length === 0 ? (
          <span className="mk-card-m">No messages yet — say hello.</span>
        ) : (
          (messages as MessageRow[]).map((m) => {
            const mine =
              (viewerIsRenter && m.sender_party === "renter") ||
              (!viewerIsRenter && m.sender_party === "seller");
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: mine ? "#ffe9d4" : "var(--mk-cream)",
                  borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  padding: "9px 12px",
                  fontSize: 14,
                }}
              >
                {m.body}
                <div className="mk-card-m" style={{ fontSize: 10, marginTop: 4 }}>
                  {m.sender_party} · {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
        <MessageForm conversationId={conversation.id} placeholder="Reply…" />
      </div>
    </main>
  );
}

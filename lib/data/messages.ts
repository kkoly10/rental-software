import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type MessageRow = {
  id: string;
  organization_id: string;
  order_id: string | null;
  customer_id: string | null;
  direction: "inbound" | "outbound";
  channel: "portal" | "dashboard" | "email" | "sms";
  subject: string | null;
  body: string;
  sender_name: string | null;
  sender_email: string | null;
  read: boolean;
  created_at: string;
};

export type MessageWithContext = MessageRow & {
  customer_name: string | null;
  order_number: string | null;
};

export type ConversationSummary = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  order_number: string | null;
  order_id: string | null;
  customer_id: string | null;
  last_subject: string | null;
  last_body: string;
  last_direction: "inbound" | "outbound";
  last_created_at: string;
  unread_count: number;
  message_count: number;
};

const demoConversations: ConversationSummary[] = [
  {
    id: "demo-1",
    customer_name: "Sarah Mitchell",
    customer_email: "sarah@example.com",
    order_number: "ORD-1042",
    order_id: null,
    customer_id: null,
    last_subject: "Delivery question",
    last_body: "Hi, I wanted to ask about the delivery time for my bounce house rental this Saturday.",
    last_direction: "inbound",
    last_created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unread_count: 1,
    message_count: 3,
  },
  {
    id: "demo-2",
    customer_name: "James Rodriguez",
    customer_email: "james.r@example.com",
    order_number: "ORD-1038",
    order_id: null,
    customer_id: null,
    last_subject: "Re: Payment confirmation",
    last_body: "Thank you for confirming the payment. Looking forward to the event!",
    last_direction: "inbound",
    last_created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    unread_count: 0,
    message_count: 2,
  },
  {
    id: "demo-3",
    customer_name: "Emily Chen",
    customer_email: "emily.c@example.com",
    order_number: "ORD-1045",
    order_id: null,
    customer_id: null,
    last_subject: "Setup instructions",
    last_body: "We've confirmed your order and delivery is set for Friday at 10 AM. Our crew will handle all setup.",
    last_direction: "outbound",
    last_created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unread_count: 0,
    message_count: 4,
  },
];

const demoThreadMessages: MessageWithContext[] = [
  {
    id: "demo-msg-1",
    organization_id: "",
    order_id: null,
    customer_id: null,
    direction: "inbound",
    channel: "portal",
    subject: "Delivery question",
    body: "Hi, I wanted to ask about the delivery time for my bounce house rental this Saturday. Can you deliver before 9 AM?",
    sender_name: "Sarah Mitchell",
    sender_email: "sarah@example.com",
    read: true,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    customer_name: "Sarah Mitchell",
    order_number: "ORD-1042",
  },
  {
    id: "demo-msg-2",
    organization_id: "",
    order_id: null,
    customer_id: null,
    direction: "outbound",
    channel: "dashboard",
    subject: "Re: Delivery question",
    body: "Hi Sarah! Yes, we can absolutely deliver before 9 AM. Our crew will arrive around 8:30 AM to set up. Please make sure the backyard gate is accessible.",
    sender_name: "Operator",
    sender_email: null,
    read: true,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    customer_name: "Sarah Mitchell",
    order_number: "ORD-1042",
  },
  {
    id: "demo-msg-3",
    organization_id: "",
    order_id: null,
    customer_id: null,
    direction: "inbound",
    channel: "portal",
    subject: "Re: Delivery question",
    body: "Perfect, thank you so much! The gate will be open. See you Saturday!",
    sender_name: "Sarah Mitchell",
    sender_email: "sarah@example.com",
    read: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    customer_name: "Sarah Mitchell",
    order_number: "ORD-1042",
  },
];

export async function getConversations(): Promise<ConversationSummary[]> {
  if (!hasSupabaseEnv()) return demoConversations;

  const ctx = await getOrgContext();
  if (!ctx) return demoConversations;

  const supabase = await createSupabaseServerClient();

  // Get all messages grouped by customer_id (or sender_email for anonymous)
  const { data: messages, error } = await supabase
    .from("messages")
    .select(
      "id, order_id, customer_id, direction, channel, subject, body, sender_name, sender_email, read, created_at"
    )
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !messages || messages.length === 0) return demoConversations;

  // Fetch customer names and order numbers
  const customerIds = [...new Set(messages.map((m) => m.customer_id).filter(Boolean))] as string[];
  const orderIds = [...new Set(messages.map((m) => m.order_id).filter(Boolean))] as string[];

  const [customersRes, ordersRes] = await Promise.all([
    customerIds.length > 0
      ? supabase
          .from("customers")
          .select("id, first_name, last_name, email")
          .in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }),
    orderIds.length > 0
      ? supabase
          .from("orders")
          .select("id, order_number")
          .in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; order_number: string }[] }),
  ]);

  const customerMap = new Map(
    (customersRes.data ?? []).map((c) => [
      c.id,
      {
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown",
        email: c.email,
      },
    ])
  );
  const orderMap = new Map(
    (ordersRes.data ?? []).map((o) => [o.id, o.order_number])
  );

  // Group by conversation key (customer_id or sender_email)
  const convMap = new Map<string, MessageRow[]>();
  for (const msg of messages) {
    const key = msg.customer_id ?? msg.sender_email ?? msg.id;
    const existing = convMap.get(key);
    if (existing) {
      existing.push(msg as MessageRow);
    } else {
      convMap.set(key, [msg as MessageRow]);
    }
  }

  const conversations: ConversationSummary[] = [];
  for (const [key, msgs] of convMap) {
    const latest = msgs[0]; // already sorted by created_at desc
    const customer = latest.customer_id ? customerMap.get(latest.customer_id) : null;

    conversations.push({
      id: key,
      customer_name: customer?.name ?? latest.sender_name ?? latest.sender_email ?? "Unknown",
      customer_email: customer?.email ?? latest.sender_email,
      order_number: latest.order_id ? orderMap.get(latest.order_id) ?? null : null,
      order_id: latest.order_id,
      customer_id: latest.customer_id,
      last_subject: latest.subject,
      last_body: latest.body,
      last_direction: latest.direction as "inbound" | "outbound",
      last_created_at: latest.created_at,
      unread_count: msgs.filter((m) => !m.read && m.direction === "inbound").length,
      message_count: msgs.length,
    });
  }

  conversations.sort(
    (a, b) => new Date(b.last_created_at).getTime() - new Date(a.last_created_at).getTime()
  );

  return conversations;
}

export async function getThreadMessages(
  conversationKey: string
): Promise<{ messages: MessageWithContext[]; customerName: string; customerEmail: string | null; orderNumber: string | null }> {
  if (!hasSupabaseEnv()) {
    return {
      messages: demoThreadMessages,
      customerName: "Sarah Mitchell",
      customerEmail: "sarah@example.com",
      orderNumber: "ORD-1042",
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { messages: [], customerName: "Unknown", customerEmail: null, orderNumber: null };
  }

  const supabase = await createSupabaseServerClient();

  // conversationKey is either a customer_id (UUID) or sender_email
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationKey);

  let query = supabase
    .from("messages")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: true });

  if (isUuid) {
    query = query.eq("customer_id", conversationKey);
  } else {
    query = query.eq("sender_email", conversationKey);
  }

  const { data: messages, error } = await query;

  if (error || !messages || messages.length === 0) {
    return { messages: [], customerName: "Unknown", customerEmail: null, orderNumber: null };
  }

  // Fetch customer and order context
  const firstMsg = messages[0];
  let customerName = firstMsg.sender_name ?? firstMsg.sender_email ?? "Unknown";
  let customerEmail = firstMsg.sender_email;
  let orderNumber: string | null = null;

  if (firstMsg.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("first_name, last_name, email")
      .eq("id", firstMsg.customer_id)
      .maybeSingle();
    if (customer) {
      customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customerName;
      customerEmail = customer.email ?? customerEmail;
    }
  }

  if (firstMsg.order_id) {
    const { data: order } = await supabase
      .from("orders")
      .select("order_number")
      .eq("id", firstMsg.order_id)
      .maybeSingle();
    orderNumber = order?.order_number ?? null;
  }

  // Mark inbound messages as read
  const unreadIds = messages
    .filter((m) => !m.read && m.direction === "inbound")
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await supabase
      .from("messages")
      .update({ read: true })
      .in("id", unreadIds);
  }

  return {
    messages: messages.map((m) => ({
      ...m,
      customer_name: customerName,
      order_number: orderNumber,
    })) as MessageWithContext[],
    customerName,
    customerEmail,
    orderNumber,
  };
}

export async function getUnreadMessageCount(): Promise<number> {
  if (!hasSupabaseEnv()) return 1;

  const ctx = await getOrgContext();
  if (!ctx) return 0;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("direction", "inbound")
    .eq("read", false);

  return count ?? 0;
}

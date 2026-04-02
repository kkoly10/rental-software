import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, getOptionalEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import {
  eventReminderEmail,
  dailyScheduleEmail,
  postEventFollowUpEmail,
  type DailyScheduleEvent,
} from "@/lib/email/templates";

// ─── Auth ──────────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  const secret = getOptionalEnv("CRON_SECRET");
  if (!secret) return false; // no secret configured → block all

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("cron_secret") === secret;
}

// ─── Date helpers ──────────────────────────────────────────────────────────

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function daysAgoDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ─── Org branding / settings helpers ───────────────────────────────────────

type OrgBranding = {
  orgId: string;
  businessName: string;
  supportEmail: string;
  siteUrl: string;
  googleReviewUrl?: string;
  slug?: string;
};

async function getOrgBrandings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgIds: string[]
): Promise<Map<string, OrgBranding>> {
  if (orgIds.length === 0) return new Map();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, support_email, slug, settings")
    .in("id", orgIds);

  const map = new Map<string, OrgBranding>();
  const siteUrl = getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

  for (const org of orgs ?? []) {
    const settings = (org.settings as Record<string, unknown>) ?? {};
    map.set(org.id, {
      orgId: org.id,
      businessName: org.name ?? "Korent",
      supportEmail: org.support_email ?? "support@korent.app",
      siteUrl,
      googleReviewUrl: (settings.social_google_business as string) || undefined,
      slug: org.slug ?? undefined,
    });
  }

  return map;
}

// ─── Day-Before Reminder ───────────────────────────────────────────────────

async function sendDayBeforeReminders(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ sent: number; errors: number }> {
  const tomorrow = tomorrowDateStr();
  let sent = 0;
  let errors = 0;

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, organization_id, order_number, event_date, notes, customer_id, customers(first_name, email, phone), order_items(item_name_snapshot)"
    )
    .eq("event_date", tomorrow)
    .in("order_status", ["confirmed", "scheduled"]);

  if (!orders || orders.length === 0) return { sent, errors };

  const orgIds = [...new Set(orders.map((o) => o.organization_id))];
  const brandings = await getOrgBrandings(supabase, orgIds);

  // Fetch delivery time windows from route_stops where available
  const orderIds = orders.map((o) => o.id);
  const { data: stops } = await supabase
    .from("route_stops")
    .select("order_id, scheduled_window_start, scheduled_window_end")
    .in("order_id", orderIds);

  const stopMap = new Map(
    (stops ?? []).map((s) => [
      s.order_id,
      {
        start: s.scheduled_window_start,
        end: s.scheduled_window_end,
      },
    ])
  );

  // Fetch delivery addresses
  const { data: addressOrders } = await supabase
    .from("orders")
    .select("id, delivery_address_id, customer_addresses(line1, city, state, postal_code)")
    .in("id", orderIds)
    .not("delivery_address_id", "is", null);

  const addressMap = new Map<string, string>();
  for (const ao of addressOrders ?? []) {
    const addr = (ao as Record<string, unknown>).customer_addresses as {
      line1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
    } | null;
    if (addr) {
      const parts = [addr.line1, addr.city, addr.state, addr.postal_code].filter(Boolean);
      if (parts.length > 0) addressMap.set(ao.id, parts.join(", "));
    }
  }

  for (const order of orders) {
    const branding = brandings.get(order.organization_id);
    if (!branding) continue;

    const customer = order.customers as unknown as {
      first_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;

    if (!customer?.email) continue;

    const items = order.order_items as unknown as { item_name_snapshot: string }[] | null;
    const productName = items?.[0]?.item_name_snapshot ?? "Rental booking";

    const stop = stopMap.get(order.id);
    let deliveryTime: string | undefined;
    if (stop?.start) {
      const startTime = new Date(stop.start).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      if (stop.end) {
        const endTime = new Date(stop.end).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        deliveryTime = `${startTime} – ${endTime}`;
      } else {
        deliveryTime = `Around ${startTime}`;
      }
    }

    try {
      await sendEmail({
        to: customer.email,
        subject: `Reminder: Your rental from ${branding.businessName} is tomorrow!`,
        html: eventReminderEmail({
          businessName: branding.businessName,
          customerFirstName: customer.first_name ?? "there",
          orderNumber: order.order_number,
          productName,
          eventDate: formatDate(order.event_date),
          deliveryTime,
          deliveryAddress: addressMap.get(order.id),
          supportEmail: branding.supportEmail,
        }),
        replyTo: branding.supportEmail,
        organizationId: order.organization_id,
      });
      sent++;

      // SMS reminder (non-blocking)
      if (customer.phone) {
        import("@/lib/sms/send-notification")
          .then(({ sendSmsNotification }) =>
            sendSmsNotification(
              "deliveryScheduled",
              customer.phone!,
              {
                orderNumber: order.order_number,
                date: "tomorrow",
                timeWindow: deliveryTime ?? "See your email for details",
                businessName: branding.businessName,
              },
              order.organization_id
            )
          )
          .catch(() => {});
      }
    } catch {
      errors++;
    }
  }

  return { sent, errors };
}

// ─── Morning-Of Digest ────────────────────────────────────────────────────

async function sendMorningDigests(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ sent: number; errors: number }> {
  const today = todayDateStr();
  let sent = 0;
  let errors = 0;

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, organization_id, order_number, order_status, event_date, customer_id, customers(first_name, last_name), order_items(item_name_snapshot)"
    )
    .eq("event_date", today)
    .in("order_status", ["confirmed", "scheduled", "out_for_delivery"]);

  if (!orders || orders.length === 0) return { sent, errors };

  // Group by org
  const orgOrders = new Map<string, typeof orders>();
  for (const order of orders) {
    const existing = orgOrders.get(order.organization_id);
    if (existing) {
      existing.push(order);
    } else {
      orgOrders.set(order.organization_id, [order]);
    }
  }

  const orgIds = [...orgOrders.keys()];
  const brandings = await getOrgBrandings(supabase, orgIds);

  // Fetch delivery times
  const allOrderIds = orders.map((o) => o.id);
  const { data: stops } = await supabase
    .from("route_stops")
    .select("order_id, scheduled_window_start")
    .in("order_id", allOrderIds);

  const stopTimeMap = new Map(
    (stops ?? []).map((s) => [
      s.order_id,
      s.scheduled_window_start
        ? new Date(s.scheduled_window_start).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : undefined,
    ])
  );

  for (const [orgId, orgOrderList] of orgOrders) {
    const branding = brandings.get(orgId);
    if (!branding) continue;

    const events: DailyScheduleEvent[] = orgOrderList.map((order) => {
      const customer = order.customers as unknown as {
        first_name: string | null;
        last_name: string | null;
      } | null;
      const items = order.order_items as unknown as { item_name_snapshot: string }[] | null;

      return {
        orderNumber: order.order_number,
        customerName: customer
          ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unknown"
          : "Unknown",
        productName: items?.[0]?.item_name_snapshot ?? "Rental",
        time: stopTimeMap.get(order.id),
        status: order.order_status,
      };
    });

    try {
      await sendEmail({
        to: branding.supportEmail,
        subject: `Today's Schedule: ${events.length} event${events.length === 1 ? "" : "s"} — ${branding.businessName}`,
        html: dailyScheduleEmail({
          businessName: branding.businessName,
          date: formatDate(today),
          events,
          dashboardUrl: `${branding.siteUrl}/dashboard/deliveries`,
        }),
        organizationId: orgId,
      });
      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, errors };
}

// ─── Post-Event Follow-Up ─────────────────────────────────────────────────

async function sendPostEventFollowUps(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ sent: number; errors: number }> {
  const twoDaysAgo = daysAgoDateStr(2);
  let sent = 0;
  let errors = 0;

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, organization_id, order_number, event_date, customer_id, customers(first_name, email), order_items(item_name_snapshot)"
    )
    .eq("event_date", twoDaysAgo)
    .eq("order_status", "completed")
    .is("follow_up_sent_at", null);

  if (!orders || orders.length === 0) return { sent, errors };

  const orgIds = [...new Set(orders.map((o) => o.organization_id))];
  const brandings = await getOrgBrandings(supabase, orgIds);
  const appDomain = getOptionalEnv("NEXT_PUBLIC_APP_DOMAIN") ?? "localhost:3000";

  for (const order of orders) {
    const branding = brandings.get(order.organization_id);
    if (!branding) continue;

    const customer = order.customers as unknown as {
      first_name: string | null;
      email: string | null;
    } | null;

    if (!customer?.email) continue;

    const items = order.order_items as unknown as { item_name_snapshot: string }[] | null;
    const productName = items?.[0]?.item_name_snapshot ?? "Rental booking";

    const storefrontUrl = branding.slug
      ? `https://${branding.slug}.${appDomain}`
      : branding.siteUrl;

    try {
      await sendEmail({
        to: customer.email,
        subject: `How was your event? — ${branding.businessName}`,
        html: postEventFollowUpEmail({
          businessName: branding.businessName,
          customerFirstName: customer.first_name ?? "there",
          orderNumber: order.order_number,
          productName,
          eventDate: formatDate(order.event_date),
          reviewUrl: branding.googleReviewUrl,
          storefrontUrl,
          supportEmail: branding.supportEmail,
        }),
        replyTo: branding.supportEmail,
        organizationId: order.organization_id,
      });

      // Mark as sent
      await supabase
        .from("orders")
        .update({ follow_up_sent_at: new Date().toISOString() })
        .eq("id", order.id);

      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, errors };
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      ok: true,
      message: "Demo mode: No reminders sent.",
      dayBefore: { sent: 0, errors: 0 },
      morningDigest: { sent: 0, errors: 0 },
      followUp: { sent: 0, errors: 0 },
    });
  }

  const supabase = await createSupabaseServerClient();

  const [dayBefore, morningDigest, followUp] = await Promise.all([
    sendDayBeforeReminders(supabase).catch(() => ({ sent: 0, errors: 1 })),
    sendMorningDigests(supabase).catch(() => ({ sent: 0, errors: 1 })),
    sendPostEventFollowUps(supabase).catch(() => ({ sent: 0, errors: 1 })),
  ]);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    dayBefore,
    morningDigest,
    followUp,
  });
}

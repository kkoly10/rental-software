import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, getOptionalEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { hasResendEnv } from "@/lib/email/client";
import { logAppError } from "@/lib/observability/server";
import {
  eventReminderEmail,
  dailyScheduleEmail,
  postEventFollowUpEmail,
  type DailyScheduleEvent,
} from "@/lib/email/templates";
import { resolveEmailLocale, emailCopy } from "@/lib/email/email-i18n";
import { formatEventDate as formatEventDateIntl } from "@/lib/i18n/format-helpers";
import {
  todayUtc,
  tomorrowUtc,
  daysAgoUtc,
  formatTimeInTimeZone,
  formatDateInTimeZone,
} from "@/lib/datetime/event-time";
import { verifyCronSecret } from "@/lib/security/cron-auth";

// This job iterates matching orders and sends emails; give it headroom over
// the default serverless timeout.
export const maxDuration = 60;

// ─── Date helpers ──────────────────────────────────────────────────────────

// Date helpers use UTC arithmetic so DST transitions don't skip or
// duplicate a day. The legacy versions called `d.setDate(d.getDate() ± 1)`
// which is local-time arithmetic; on the spring-forward day this can
// produce a date one day earlier than intended on a server in a TZ that
// observes DST.
const todayDateStr = todayUtc;
const tomorrowDateStr = tomorrowUtc;
const daysAgoDateStr = daysAgoUtc;

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

// Localized event-date formatter for customer-facing emails. Operator-facing
// digests keep the English `formatDate` above.
function formatDateLocalized(dateStr: string, locale: string): string {
  return formatEventDateIntl(dateStr, locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Org branding / settings helpers ───────────────────────────────────────

type OrgBranding = {
  orgId: string;
  businessName: string;
  supportEmail: string | null;
  // Where to send operator-facing alerts. Falls back to the org owner's
  // profile email when support_email is unset so internal cron alerts
  // don't get dropped.
  operatorAlertEmail: string | null;
  siteUrl: string;
  fromAddress: string;
  googleReviewUrl?: string;
  slug?: string;
  // IANA tz used when rendering event times in customer-facing emails.
  // Defaults to "UTC" if the org hasn't set one (was: server-local-time).
  eventTimezone: string;
};

function buildFromAddress(businessName: string): string {
  const rawAddress = getOptionalEnv("EMAIL_FROM_ADDRESS") ?? "noreply@korent.app";
  const emailOnly = rawAddress.replace(/^.*<(.+)>$/, "$1").trim();
  const safeName = businessName.replace(/[\r\n\t]/g, "").replace(/[^\w\s'-]/g, "").trim() || "Rental Company";
  return `${safeName} <${emailOnly}>`;
}

async function getOrgBrandings(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgIds: string[]
): Promise<Map<string, OrgBranding>> {
  if (orgIds.length === 0) return new Map();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, support_email, slug, settings, event_timezone")
    .in("id", orgIds)
    .is("deleted_at", null);

  const map = new Map<string, OrgBranding>();
  const siteUrl = getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

  // Fetch owner emails in one round-trip for orgs that need an alert fallback.
  const orgsMissingSupport = (orgs ?? []).filter((o) => !o.support_email).map((o) => o.id);
  const ownerEmailByOrg = new Map<string, string>();
  if (orgsMissingSupport.length > 0) {
    const { data: owners } = await supabase
      .from("organization_memberships")
      .select("organization_id, profiles(email)")
      .in("organization_id", orgsMissingSupport)
      .eq("role", "owner")
      .eq("status", "active");
    for (const m of owners ?? []) {
      const email = (m as { profiles?: { email?: string | null } | null }).profiles?.email;
      if (email && !ownerEmailByOrg.has(m.organization_id)) {
        ownerEmailByOrg.set(m.organization_id, email);
      }
    }
  }

  for (const org of orgs ?? []) {
    const settings = (org.settings as Record<string, unknown>) ?? {};
    const businessName = org.name ?? "Rental Company";
    const supportEmail = org.support_email ?? null;
    map.set(org.id, {
      orgId: org.id,
      businessName,
      supportEmail,
      operatorAlertEmail: supportEmail ?? ownerEmailByOrg.get(org.id) ?? null,
      siteUrl,
      fromAddress: buildFromAddress(businessName),
      googleReviewUrl: (settings.social_google_business as string) || undefined,
      slug: org.slug ?? undefined,
      eventTimezone: org.event_timezone ?? "UTC",
    });
  }

  return map;
}

// ─── Day-Before Reminder ───────────────────────────────────────────────────

async function sendDayBeforeReminders(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ sent: number; errors: number; smsErrors: number }> {
  const tomorrow = tomorrowDateStr();
  let sent = 0;
  let errors = 0;
  // Soft failures: counted but don't block the run. Tracks email
  // provider failures and SMS send errors so a sustained outage is
  // visible in the cron response payload instead of vanishing into
  // empty catch blocks.
  let smsErrors = 0;

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, organization_id, order_number, event_date, notes, customer_id, customers(first_name, email, phone, sms_opt_in, preferred_locale), order_items(item_name_snapshot)"
    )
    .eq("event_date", tomorrow)
    .is("deleted_at", null)
    .in("order_status", ["confirmed", "scheduled"])
    .is("day_before_reminder_sent_at", null)
    // Bound the per-run batch. If more than this many orders need reminding
    // tomorrow, the cron's 60s budget probably won't cover them anyway; the
    // claim-on-update pattern means a follow-up run picks up the rest.
    .limit(2000);

  if (!orders || orders.length === 0) return { sent, errors, smsErrors };

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
    .select("id, delivery_address_id, customer_addresses!delivery_address_id(line1, city, state, postal_code)")
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
      sms_opt_in: boolean | null;
      preferred_locale: string | null;
    } | null;

    if (!customer?.email) continue;

    const customerLocale = resolveEmailLocale(customer.preferred_locale);

    const items = order.order_items as unknown as { item_name_snapshot: string }[] | null;
    const productName = items?.[0]?.item_name_snapshot ?? "Rental booking";

    const stop = stopMap.get(order.id);
    let deliveryTime: string | undefined;
    if (stop?.start) {
      // Render times in the org's IANA timezone so customers don't see
      // "Tomorrow at 5 PM" for what the operator wrote as "Tomorrow at
      // 9 AM PT" (5pm = the UTC stored value, 9am PT = what was meant).
      const startTime = formatTimeInTimeZone(stop.start, branding.eventTimezone);
      if (stop.end) {
        const endTime = formatTimeInTimeZone(stop.end, branding.eventTimezone);
        deliveryTime = `${startTime} – ${endTime}`;
      } else {
        deliveryTime = `Around ${startTime}`;
      }
    }

    try {
      // Atomically claim this order before sending. If two cron instances run
      // concurrently, only the first to write wins; the second sees count=0 and skips.
      const { data: claimed } = await supabase
        .from("orders")
        .update({ day_before_reminder_sent_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("day_before_reminder_sent_at", null)
        .select("id");

      if (!claimed || claimed.length === 0) continue;

      const emailed = await sendEmail({
        to: customer.email,
        from: branding.fromAddress,
        subject: emailCopy(customerLocale).subjects.eventReminder(branding.businessName),
        html: eventReminderEmail({
          businessName: branding.businessName,
          customerFirstName: customer.first_name ?? "there",
          orderNumber: order.order_number,
          productName,
          eventDate: formatDateLocalized(order.event_date, customerLocale),
          deliveryTime,
          deliveryAddress: addressMap.get(order.id),
          supportEmail: branding.supportEmail,
          locale: customerLocale,
        }),
        replyTo: branding.supportEmail ?? undefined,
        organizationId: order.organization_id,
      });

      if (!emailed) {
        // Release the claim so a later run retries a *transient* failure. Only
        // do so when email is actually configured — a missing provider is a
        // permanent condition and releasing would loop forever.
        if (hasResendEnv()) {
          await supabase
            .from("orders")
            .update({ day_before_reminder_sent_at: null })
            .eq("id", order.id);
        }
        // Log the provider failure so a sustained outage shows up in
        // observability instead of looking like "no reminders today".
        await logAppError({
          organizationId: order.organization_id,
          source: "cron-reminders",
          message: "day-before reminder email failed at provider",
          route: "/api/cron/reminders",
          context: { order_id: order.id, order_number: order.order_number, recipient: customer.email, will_retry: hasResendEnv() },
        });
        smsErrors++; // counted as a soft failure in the response
        continue;
      }

      sent++;

      // SMS reminder — must be awaited; fire-and-forget is killed by Lambda
      // before the import resolves. Failure is non-critical (email already sent)
      // but is now counted and logged so a provider outage is visible in the
      // cron's response payload.
      if (customer.phone && customer.sms_opt_in) {
        try {
          const { sendSmsNotification } = await import("@/lib/sms/send-notification");
          await sendSmsNotification(
            "deliveryScheduled",
            customer.phone!,
            {
              orderNumber: order.order_number,
              date: "tomorrow",
              timeWindow: deliveryTime ?? "See your email for details",
              businessName: branding.businessName,
            },
            order.organization_id,
            { orderId: order.id, customerId: order.customer_id }
          );
        } catch (smsErr) {
          smsErrors++;
          await logAppError({
            organizationId: order.organization_id,
            source: "cron-reminders",
            message: "day-before SMS reminder failed (email already sent)",
            route: "/api/cron/reminders",
            context: { order_id: order.id, order_number: order.order_number },
            error: smsErr,
          });
        }
      }
    } catch (err) {
      console.error(`[reminders] day-before failed for order ${order.id} (${order.order_number}):`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  return { sent, errors, smsErrors };
}

// ─── Morning-Of Digest ────────────────────────────────────────────────────

async function sendMorningDigests(
  supabase: ReturnType<typeof createSupabaseAdminClient>
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
    .is("deleted_at", null)
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

  // Store the raw ISO timestamp; format per-order below so the org's
  // IANA timezone is applied. The legacy version formatted at map-build
  // time using server-local TZ — wrong for any org outside the server's
  // region.
  const stopTimeMap = new Map(
    (stops ?? []).map((s) => [s.order_id, s.scheduled_window_start ?? null])
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

      const rawTime = stopTimeMap.get(order.id);
      return {
        orderNumber: order.order_number,
        customerName: customer
          ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unknown"
          : "Unknown",
        productName: items?.[0]?.item_name_snapshot ?? "Rental",
        time: rawTime ? formatTimeInTimeZone(rawTime, branding.eventTimezone) : undefined,
        status: order.order_status,
      };
    });

    if (!branding.operatorAlertEmail) continue;

    try {
      await sendEmail({
        to: branding.operatorAlertEmail,
        from: branding.fromAddress,
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
    } catch (err) {
      console.error(`[reminders] morning digest failed for org ${orgId}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  return { sent, errors };
}

// ─── Post-Event Follow-Up ─────────────────────────────────────────────────

async function sendPostEventFollowUps(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ sent: number; errors: number }> {
  const twoDaysAgo = daysAgoDateStr(2);
  let sent = 0;
  let errors = 0;

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, organization_id, order_number, event_date, customer_id, customers(first_name, email, preferred_locale), order_items(item_name_snapshot)"
    )
    .eq("event_date", twoDaysAgo)
    .is("deleted_at", null)
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
      preferred_locale: string | null;
    } | null;

    if (!customer?.email) continue;

    const customerLocale = resolveEmailLocale(customer.preferred_locale);

    const items = order.order_items as unknown as { item_name_snapshot: string }[] | null;
    const productName = items?.[0]?.item_name_snapshot ?? "Rental booking";

    const storefrontUrl = branding.slug
      ? `https://${branding.slug}.${appDomain}`
      : branding.siteUrl;

    try {
      // Atomically claim before sending to prevent duplicate emails from concurrent cron runs
      const { data: claimed } = await supabase
        .from("orders")
        .update({ follow_up_sent_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("follow_up_sent_at", null)
        .select("id");

      if (!claimed || claimed.length === 0) continue;

      const emailed = await sendEmail({
        to: customer.email,
        from: branding.fromAddress,
        subject: emailCopy(customerLocale).subjects.postEventFollowUp(branding.businessName),
        html: postEventFollowUpEmail({
          businessName: branding.businessName,
          customerFirstName: customer.first_name ?? "there",
          orderNumber: order.order_number,
          productName,
          eventDate: formatDateLocalized(order.event_date, customerLocale),
          reviewUrl: branding.googleReviewUrl,
          storefrontUrl,
          supportEmail: branding.supportEmail,
          locale: customerLocale,
        }),
        replyTo: branding.supportEmail ?? undefined,
        organizationId: order.organization_id,
      });

      if (!emailed) {
        // Release only transient failures (see day-before note); skip when no
        // email provider is configured to avoid an every-run retry loop.
        if (hasResendEnv()) {
          await supabase
            .from("orders")
            .update({ follow_up_sent_at: null })
            .eq("id", order.id);
        }
        continue;
      }

      sent++;
    } catch (err) {
      console.error(`[reminders] post-event follow-up failed for order ${order.id} (${order.order_number}):`, err instanceof Error ? err.message : err);
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

  const supabase = createSupabaseAdminClient();

  // #399 Capture the actual exception so a failing section is visible in
  // logs and Sentry instead of just returning `{sent:0, errors:1}` silently.
  const cronCatch = (label: string) => async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron/reminders] ${label} failed:`, msg);
    try {
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        source: `cron.reminders.${label}`,
        message: `Cron section "${label}" threw`,
        context: { reason: msg },
        error: err,
      });
    } catch { /* logger failures must not break the cron */ }
    return { sent: 0, errors: 1, smsErrors: 0 };
  };

  const [dayBefore, morningDigest, followUp, deposit] = await Promise.all([
    sendDayBeforeReminders(supabase).catch(cronCatch("dayBefore")),
    sendMorningDigests(supabase).catch(cronCatch("morningDigest")),
    sendPostEventFollowUps(supabase).catch(cronCatch("followUp")),
    sendDepositReminders(supabase).catch(cronCatch("depositReminder")),
  ]);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    dayBefore,
    morningDigest,
    followUp,
    deposit,
  });
}

// ─── Deposit reminder (customer-facing) ───────────────────────────────────

/**
 * For each `awaiting_deposit` order that's at least one day old and
 * hasn't had a deposit reminder yet, send one. Capped at 100 orders per
 * cron run so a backlog doesn't blow up the email quota in a single
 * invocation.
 */
async function sendDepositReminders(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, organization_id, order_number, event_date, deposit_due_amount, customer_id, customers(first_name, email), order_items(item_name_snapshot)"
    )
    .eq("order_status", "awaiting_deposit")
    .is("deleted_at", null)
    .is("deposit_reminder_sent_at", null)
    .lt("created_at", oneDayAgoIso)
    .limit(100);

  if (!orders || orders.length === 0) return { sent, errors };

  const { triggerDepositReminderEmail } = await import("@/lib/email/triggers");

  for (const order of orders) {
    const customer = order.customers as unknown as {
      first_name: string | null;
      email: string | null;
    } | null;
    if (!customer?.email) continue;

    const items = order.order_items as unknown as { item_name_snapshot: string }[] | null;
    const productName = items?.[0]?.item_name_snapshot ?? "Rental booking";

    try {
      const { data: claimed } = await supabase
        .from("orders")
        .update({ deposit_reminder_sent_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("deposit_reminder_sent_at", null)
        .select("id");

      if (!claimed || claimed.length === 0) continue;

      const ok = await triggerDepositReminderEmail({
        organizationId: order.organization_id,
        customerFirstName: customer.first_name ?? "there",
        customerEmail: customer.email,
        orderId: order.id,
        orderNumber: order.order_number,
        productName,
        eventDate: order.event_date ?? "",
        depositDue: Number(order.deposit_due_amount ?? 0),
      });

      if (!ok) {
        // Release the claim so a future run retries — only when Resend
        // is configured. A missing provider is permanent; releasing
        // would just loop.
        if (hasResendEnv()) {
          await supabase
            .from("orders")
            .update({ deposit_reminder_sent_at: null })
            .eq("id", order.id);
        }
        errors++;
        continue;
      }

      sent++;
    } catch (err) {
      errors++;
      console.error("[cron.depositReminder]", order.order_number, err instanceof Error ? err.message : err);
    }
  }

  return { sent, errors };
}

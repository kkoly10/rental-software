import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/copilot/system-prompt";
import {
  getArticleSummaries,
  getOperationalContext,
  getPageHelpContext,
  getSnapshotContext,
} from "@/lib/copilot/context";
import {
  getGuidanceSnapshot,
  type GuidanceSnapshot,
} from "@/lib/data/guidance-snapshot";
import {
  getOperationalSnapshot,
  type OperationalSnapshot,
} from "@/lib/data/operational-snapshot";
import { searchArticles } from "@/lib/help/articles";
import { pageHelpMap } from "@/lib/help/page-help";
import { checklistItems } from "@/lib/guidance/checklist";
import { getOptionalEnv } from "@/lib/env";
import { copilotRequestSchema } from "@/lib/validation/copilot";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import { getCopilotAccessContext } from "@/lib/security/copilot-access";
import { getRequestClientKey } from "@/lib/security/request-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { formatMoney } from "@/lib/i18n/format-helpers";

export const runtime = "nodejs";

function jsonResponse(
  body: Record<string, unknown>,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function rateLimitResponse(retryAfterSeconds: number) {
  const response = jsonResponse(
    {
      error:
        "Copilot is temporarily busy. Please wait a moment before sending another message.",
    },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

function extractProviderText(payload: any): string | null {
  if (typeof payload?.choices?.[0]?.message?.content === "string") {
    return payload.choices[0].message.content;
  }

  if (typeof payload?.content?.[0]?.text === "string") {
    return payload.content[0].text;
  }

  // Never surface a provider error body as the assistant's reply — returning
  // null lets the caller fall back to the local response instead.
  return null;
}

export async function POST(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) {
    await logAppError({
      source: "copilot.route",
      message: "Rejected invalid request origin",
      route: request.nextUrl.pathname,
      context: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
      },
    });

    return jsonResponse({ error: "Invalid request origin." }, { status: 403 });
  }

  const access = await getCopilotAccessContext();
  if (!access) {
    await logAppError({
      source: "copilot.route",
      message: "Rejected unauthenticated Copilot access",
      route: request.nextUrl.pathname,
    });

    return jsonResponse(
      { error: "You must be signed in to use Copilot." },
      { status: 401 }
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    await logAppError({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.route",
      message: "Invalid Copilot JSON payload",
      route: request.nextUrl.pathname,
    });

    return jsonResponse({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = copilotRequestSchema.safeParse(requestBody);
  if (!parsed.success) {
    await logAppError({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.route",
      message: "Invalid Copilot request payload",
      route: request.nextUrl.pathname,
      context: {
        issue: parsed.error.issues[0]?.message,
      },
    });

    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { message, route } = parsed.data;
  const clientKey = getRequestClientKey(request);

  try {
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "copilot:user",
        actor: access.userId,
        limit: 20,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "copilot:client",
        actor: clientKey,
        limit: 60,
        windowSeconds: 300,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      await logAppEvent({
        organizationId: access.organizationId,
        userId: access.userId,
        source: "copilot.route",
        action: "rate_limited",
        status: "warning",
        route,
        metadata: {
          retryAfterSeconds: Math.max(
            userLimit.retryAfterSeconds,
            clientLimit.retryAfterSeconds
          ),
        },
      });

      return rateLimitResponse(
        Math.max(userLimit.retryAfterSeconds, clientLimit.retryAfterSeconds)
      );
    }
  } catch (error) {
    await logAppError({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.route",
      message: "Copilot rate limiting unavailable",
      route,
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return jsonResponse(
      { error: "Copilot rate limiting is temporarily unavailable." },
      { status: 503 }
    );
  }

  const [snapshot, opSnapshot] = await Promise.all([
    getGuidanceSnapshot(),
    getOperationalSnapshot(),
  ]);
  const pageHelp = getPageHelpContext(route);
  const snapshotContext = getSnapshotContext(snapshot);
  const liveOpsContext = getOperationalContext(opSnapshot);
  const articleSummaries = getArticleSummaries();

  // Built once and reused: it's both the no-provider response and the
  // graceful fallback when a configured provider errors or times out.
  const localResponse = generateLocalResponse(message, route, snapshot, opSnapshot);

  const openaiKey = getOptionalEnv("OPENAI_API_KEY");
  const anthropicKey = getOptionalEnv("ANTHROPIC_API_KEY");

  if (openaiKey) {
    const aiResponse = await handleOpenAI(
      openaiKey,
      message,
      route,
      pageHelp,
      snapshotContext,
      liveOpsContext,
      articleSummaries,
      localResponse
    );

    await logAppEvent({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.route",
      action: "response_generated",
      status: "success",
      route,
      metadata: {
        provider: "openai",
      },
    });

    return jsonResponse({ response: aiResponse });
  }

  if (anthropicKey) {
    const aiResponse = await handleAnthropic(
      anthropicKey,
      message,
      route,
      pageHelp,
      snapshotContext,
      liveOpsContext,
      articleSummaries,
      localResponse
    );

    await logAppEvent({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.route",
      action: "response_generated",
      status: "success",
      route,
      metadata: {
        provider: "anthropic",
      },
    });

    return jsonResponse({ response: aiResponse });
  }

  await logAppEvent({
    organizationId: access.organizationId,
    userId: access.userId,
    source: "copilot.route",
    action: "response_generated",
    status: "success",
    route,
    metadata: {
      provider: "local",
    },
  });

  return jsonResponse({
    response: localResponse,
  });
}

async function handleOpenAI(
  apiKey: string,
  message: string,
  route: string,
  pageHelp: string,
  snapshot: string,
  liveOps: string,
  articles: string,
  fallback: string
) {
  try {
    const systemPrompt = buildSystemPrompt({
      currentRoute: route,
      pageHelp,
      snapshot,
      liveOps,
      articleSummaries: articles,
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // Bound the outbound call so a hung provider doesn't block the function.
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    const data = await res.json().catch(() => null);
    const reply = extractProviderText(data);

    if (!res.ok || !reply) {
      return fallback;
    }

    return reply;
  } catch {
    return fallback;
  }
}

async function handleAnthropic(
  apiKey: string,
  message: string,
  route: string,
  pageHelp: string,
  snapshot: string,
  liveOps: string,
  articles: string,
  fallback: string
) {
  try {
    const systemPrompt = buildSystemPrompt({
      currentRoute: route,
      pageHelp,
      snapshot,
      liveOps,
      articleSummaries: articles,
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      // Bound the outbound call so a hung provider doesn't block the function.
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await res.json().catch(() => null);
    const reply = extractProviderText(data);

    if (!res.ok || !reply) {
      return fallback;
    }

    return reply;
  } catch {
    return fallback;
  }
}

function answerOperationalQuestion(
  q: string,
  ops: OperationalSnapshot
): string | null {
  const money = (n: number) => formatMoney(n, ops.currency, ops.locale);

  // "What needs my attention?" — a quick daily-briefing roundup.
  if (
    (q.includes("attention") ||
      q.includes("briefing") ||
      q.includes("brief me") ||
      q.includes("what's up") ||
      q.includes("whats up") ||
      q.includes("catch me up") ||
      q.includes("to do") ||
      q.includes("to-do") ||
      q.includes("todo")) &&
    !q.includes("how do")
  ) {
    const items: string[] = [];
    if (ops.balanceDueSoonCount > 0) {
      items.push(
        `- **${ops.balanceDueSoonCount} upcoming order${ops.balanceDueSoonCount === 1 ? "" : "s"}** still owe ${money(ops.balanceDueSoonTotal)} — collect at [Payments](/dashboard/payments).`
      );
    }
    if (ops.unsignedDocsUpcoming > 0) {
      items.push(
        `- **${ops.unsignedDocsUpcoming} document${ops.unsignedDocsUpcoming === 1 ? "" : "s"}** still unsigned for upcoming events — chase at [Documents](/dashboard/documents).`
      );
    }
    if (ops.unreadMessages > 0) {
      items.push(
        `- **${ops.unreadMessages} unread message${ops.unreadMessages === 1 ? "" : "s"}** — reply at [Messages](/dashboard/messages).`
      );
    }
    if (ops.openMaintenance > 0) {
      items.push(
        `- **${ops.openMaintenance} asset${ops.openMaintenance === 1 ? "" : "s"}** in maintenance — review at [Maintenance](/dashboard/maintenance).`
      );
    }

    const header =
      ops.eventsToday > 0
        ? `You have **${ops.eventsToday} event${ops.eventsToday === 1 ? "" : "s"} today** and ${ops.eventsNext7Days} in the next 7 days.`
        : `You have **${ops.eventsNext7Days} event${ops.eventsNext7Days === 1 ? "" : "s"}** in the next 7 days.`;

    if (items.length === 0) {
      return `${header}\n\nNothing is blocking your upcoming events — no balances due soon, no unsigned documents, no unread messages, and no assets in maintenance. You're in good shape. 🎉`;
    }
    return `${header}\n\nHere's what needs your attention:\n\n${items.join("\n")}`;
  }

  // Money owed / outstanding balance.
  if (
    q.includes("owed") ||
    q.includes("owe me") ||
    q.includes("outstanding") ||
    q.includes("balance due") ||
    q.includes("unpaid") ||
    q.includes("who hasn't paid") ||
    q.includes("who hasnt paid")
  ) {
    if (ops.outstandingBalance <= 0) {
      return "You have no outstanding balances right now — every live order is fully paid. 🎉";
    }
    let msg = `You're owed **${money(ops.outstandingBalance)}** in total across your live orders.`;
    if (ops.balanceDueSoonCount > 0) {
      msg += ` Of that, ${money(ops.balanceDueSoonTotal)} is on **${ops.balanceDueSoonCount} order${ops.balanceDueSoonCount === 1 ? "" : "s"} with events in the next 7 days** — those are the most urgent to collect.`;
    }
    msg += `\n\nTo see who owes what and record payments, go to [Payments](/dashboard/payments) or open the specific order.`;
    return msg;
  }

  // What's happening today / this week.
  if (
    q.includes("today") ||
    q.includes("this week") ||
    q.includes("upcoming") ||
    q.includes("schedule") ||
    q.includes("what's on") ||
    q.includes("whats on") ||
    q.includes("happening")
  ) {
    return `You have **${ops.eventsToday} event${ops.eventsToday === 1 ? "" : "s"} today** and **${ops.eventsNext7Days} in the next 7 days**.${
      ops.balanceDueSoonCount > 0
        ? ` ${ops.balanceDueSoonCount} of the upcoming order${ops.balanceDueSoonCount === 1 ? "" : "s"} still ${ops.balanceDueSoonCount === 1 ? "owes" : "owe"} a balance (${money(ops.balanceDueSoonTotal)}).`
        : ""
    }\n\nView the full schedule on the [Calendar](/dashboard/calendar) or plan delivery routes at [Deliveries](/dashboard/deliveries).`;
  }

  // How am I doing this month / revenue.
  if (
    q.includes("this month") ||
    q.includes("revenue") ||
    q.includes("how am i doing") ||
    q.includes("how's business") ||
    q.includes("hows business") ||
    q.includes("collected") ||
    q.includes("made this")
  ) {
    return `You've collected **${money(ops.revenueThisMonth)}** so far this month across ${ops.paymentsThisMonthCount} payment${ops.paymentsThisMonthCount === 1 ? "" : "s"}.${
      ops.outstandingBalance > 0
        ? ` You still have ${money(ops.outstandingBalance)} outstanding across live orders.`
        : ""
    }\n\nFor revenue trends, top products, and busiest days, open [Analytics](/dashboard/analytics).`;
  }

  // Unread messages.
  if (
    q.includes("message") ||
    q.includes("unread") ||
    q.includes("inbox") ||
    q.includes("reply") ||
    q.includes("replies")
  ) {
    if (ops.unreadMessages <= 0) {
      return "Your inbox is clear — no unread customer messages right now. View the conversation history at [Messages](/dashboard/messages).";
    }
    return `You have **${ops.unreadMessages} unread customer message${ops.unreadMessages === 1 ? "" : "s"}**. Reply at [Messages](/dashboard/messages).`;
  }

  return null;
}

function generateLocalResponse(
  message: string,
  route: string,
  snapshot: GuidanceSnapshot,
  opSnapshot?: OperationalSnapshot
): string {
  const q = message.toLowerCase();

  // Live operational questions — answered from real business data when
  // available, so the no-API-key fallback is still genuinely useful.
  if (opSnapshot?.available) {
    const opsAnswer = answerOperationalQuestion(q, opSnapshot);
    if (opsAnswer) return opsAnswer;
  }

  if (
    q.includes("next") ||
    q.includes("set up") ||
    q.includes("get started") ||
    q.includes("first")
  ) {
    const incomplete = checklistItems.filter((item) => !item.isComplete(snapshot));
    if (incomplete.length === 0) {
      return "Your setup looks complete! You have products, images, service areas, orders, payments, and documents configured. You're ready to take real bookings. Consider sharing your storefront link with potential customers.";
    }
    const next = incomplete[0];
    const remaining = incomplete.length;
    return `**Next step: ${next.title}**\n\n${next.description}\n\nGo to [${next.href}](${next.href}) to complete this step. You have ${remaining} remaining setup task${remaining > 1 ? "s" : ""}.`;
  }

  if (q.includes("explain") && (q.includes("page") || q.includes("this"))) {
    const help = pageHelpMap[route];
    if (help) {
      return `**${help.title}**\n\n${help.description}`;
    }
    return "This is a dashboard page in Korent. Use the sidebar to navigate between sections like Orders, Products, Payments, and more.";
  }

  const relevantArticles = searchArticles(message);
  if (relevantArticles.length > 0) {
    const best = relevantArticles[0];
    const firstPara = best.body.split("\n\n").slice(0, 2).join("\n\n");
    return `**${best.title}**\n\n${firstPara}\n\nFor the full guide, visit the Help Center article: [${best.title}](/dashboard/help/${best.slug})`;
  }

  if (q.includes("payment") || q.includes("deposit") || q.includes("pay")) {
    return "To record a payment, go to **Payments** in the sidebar or open a specific order. Select the order, enter the amount, choose a payment method (Cash, Check, Venmo, Zelle, Card, or Other), and optionally add a reference note. Orders auto-confirm when fully paid.\n\nSee the full guide: [Recording payments](/dashboard/help/recording-payments)";
  }

  if (q.includes("order") || q.includes("booking")) {
    return "To create an order, go to **Orders** > **Create New Order**. Select a customer, choose an event date, add products, and pick a delivery service area. Orders move from Inquiry → Confirmed → Delivered → Completed.\n\nSee the full guide: [Creating orders](/dashboard/help/creating-orders)";
  }

  if (q.includes("product") || q.includes("catalog") || q.includes("inflatable") || q.includes("add")) {
    return "To add a product to your catalog, go to [Products → Add Product](/dashboard/products/new). Enter a name customers would search for, set your daily rental price, add a description with dimensions and age range, and make sure \"Active\" is checked so it shows on your storefront.";
  }

  if (q.includes("delivery") || q.includes("route") || q.includes("driver") || q.includes("crew")) {
    return "The [Delivery Board](/dashboard/deliveries) shows all upcoming deliveries grouped by date. You can plan routes, assign crew members, and track delivery status. Each delivery shows the customer address, time window, and order details so your crew knows exactly where to go.";
  }

  if (q.includes("customer") || q.includes("contact") || q.includes("email") || q.includes("phone")) {
    return "Customer records are created automatically when you make an order or when someone books through your storefront. View and manage all customers at [Customers](/dashboard/customers). Each record shows their contact info, order history, and lifetime value.";
  }

  if (q.includes("website") || q.includes("storefront") || q.includes("homepage") || q.includes("hero")) {
    return "Customize your public storefront at [Website Settings](/dashboard/website). You can edit the hero message, FAQ, about section, testimonials, trust badges, brand colors, and control which sections are visible. Changes appear immediately on your public booking page.";
  }

  if (q.includes("service area") || q.includes("zip") || q.includes("delivery zone") || q.includes("coverage")) {
    return "Service areas define where you deliver and the fees for each zone. Set them up at [Service Areas](/dashboard/service-areas). Add ZIP codes, set delivery fees and minimum order amounts, and view coverage on the interactive map.";
  }

  if (q.includes("price") || q.includes("pricing") || q.includes("surcharge") || q.includes("discount")) {
    return "Dynamic pricing rules let you automatically adjust prices based on conditions. Go to [Pricing](/dashboard/pricing) to create rules like weekend surcharges, weekday discounts, holiday pricing, or multi-day bundle rates. Rules stack and apply automatically at checkout.";
  }

  if (q.includes("document") || q.includes("agreement") || q.includes("waiver") || q.includes("sign")) {
    return "Rental documents (waivers, agreements, terms) can be managed at [Documents](/dashboard/documents). Attach them to orders and customers can sign digitally through the customer portal. Signed documents are stored with timestamps for your records.";
  }

  if (q.includes("weather") || q.includes("rain") || q.includes("storm") || q.includes("forecast")) {
    return "Weather alerts appear automatically on orders that have an event date and delivery ZIP code. The system checks the forecast and shows a green/yellow/red indicator so you and your customers can plan ahead for outdoor events.";
  }

  if (q.includes("analytics") || q.includes("revenue") || q.includes("report") || q.includes("stats")) {
    return "View your business performance at [Analytics](/dashboard/analytics). Track revenue trends, order volume, popular products, and customer growth. Use the date filters to compare different time periods.";
  }

  if (q.includes("sms") || q.includes("text") || q.includes("notification") || q.includes("twilio")) {
    return "SMS notifications keep customers informed automatically. Set up your Twilio credentials and enable notification types at [Settings → SMS Notifications](/dashboard/settings). You can send alerts for order confirmations, delivery updates, payment receipts, and more.";
  }

  return 'I can help you with:\n\n- **"What should I do next?"** — Get your next setup step\n- **"Explain this page"** — Learn what the current page does\n- **"How do I add a product?"** — Step-by-step for catalog items\n- **"How do deliveries work?"** — Route planning and crew dispatch\n- **"How do I customize my website?"** — Storefront editing guide\n- **"How does pricing work?"** — Dynamic pricing rules\n- **"How do I set up SMS?"** — Text notification setup\n\nAsk me anything about running your rental business!';
}
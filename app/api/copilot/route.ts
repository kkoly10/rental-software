import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/copilot/system-prompt";
import {
  getArticleSummaries,
  getPageHelpContext,
  getSnapshotContext,
} from "@/lib/copilot/context";
import {
  getGuidanceSnapshot,
  type GuidanceSnapshot,
} from "@/lib/data/guidance-snapshot";
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

  if (typeof payload?.error?.message === "string") {
    return payload.error.message;
  }

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
    });

    return jsonResponse(
      { error: "Copilot rate limiting is temporarily unavailable." },
      { status: 503 }
    );
  }

  const snapshot = await getGuidanceSnapshot();
  const pageHelp = getPageHelpContext(route);
  const snapshotContext = getSnapshotContext(snapshot);
  const articleSummaries = getArticleSummaries();

  const openaiKey = getOptionalEnv("OPENAI_API_KEY");
  const anthropicKey = getOptionalEnv("ANTHROPIC_API_KEY");

  if (openaiKey) {
    const aiResponse = await handleOpenAI(
      openaiKey,
      message,
      route,
      pageHelp,
      snapshotContext,
      articleSummaries
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
      articleSummaries
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
    response: generateLocalResponse(message, route, snapshot),
  });
}

async function handleOpenAI(
  apiKey: string,
  message: string,
  route: string,
  pageHelp: string,
  snapshot: string,
  articles: string
) {
  const fallback = generateLocalResponse(message, route, {
    businessName: "",
    supportEmail: "",
    phone: "",
    heroMessage: "",
    productsCount: 0,
    productImagesCount: 0,
    serviceAreasCount: 0,
    ordersCount: 0,
    paymentsCount: 0,
    documentsCount: 0,
    hasBusinessProfile: false,
    hasWebsiteSettings: false,
  });

  try {
    const systemPrompt = buildSystemPrompt({
      currentRoute: route,
      pageHelp,
      snapshot,
      articleSummaries: articles,
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
  articles: string
) {
  const fallback = generateLocalResponse(message, route, {
    businessName: "",
    supportEmail: "",
    phone: "",
    heroMessage: "",
    productsCount: 0,
    productImagesCount: 0,
    serviceAreasCount: 0,
    ordersCount: 0,
    paymentsCount: 0,
    documentsCount: 0,
    hasBusinessProfile: false,
    hasWebsiteSettings: false,
  });

  try {
    const systemPrompt = buildSystemPrompt({
      currentRoute: route,
      pageHelp,
      snapshot,
      articleSummaries: articles,
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
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

function generateLocalResponse(
  message: string,
  route: string,
  snapshot: GuidanceSnapshot
): string {
  const q = message.toLowerCase();

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
    return "This is a dashboard page in RentalOS. Use the sidebar to navigate between sections like Orders, Products, Payments, and more.";
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

  return 'I can help you with:\n\n- **Getting set up** — Ask "What should I do next?"\n- **Page explanations** — Ask "Explain this page"\n- **How-to questions** — Ask about orders, payments, products, deliveries, or documents\n- **Troubleshooting** — Ask about specific issues you\'re experiencing\n\nTry one of the suggested prompts below, or ask me a specific question about your rental business platform.';
}
import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/copilot/system-prompt";
import { getPageHelpContext, getSnapshotContext, getArticleSummaries } from "@/lib/copilot/context";
import { getGuidanceSnapshot, type GuidanceSnapshot } from "@/lib/data/guidance-snapshot";
import { searchArticles } from "@/lib/help/articles";
import { pageHelpMap } from "@/lib/help/page-help";
import { checklistItems } from "@/lib/guidance/checklist";
import { getOptionalEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  const { message, route } = await request.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const snapshot = await getGuidanceSnapshot();
  const pageHelp = getPageHelpContext(route || "/dashboard");
  const snapshotContext = getSnapshotContext(snapshot);
  const articleSummaries = getArticleSummaries();

  // Check if external AI is configured
  const openaiKey = getOptionalEnv("OPENAI_API_KEY");
  const anthropicKey = getOptionalEnv("ANTHROPIC_API_KEY");

  if (openaiKey) {
    return handleOpenAI(openaiKey, message, route, pageHelp, snapshotContext, articleSummaries);
  }

  if (anthropicKey) {
    return handleAnthropic(anthropicKey, message, route, pageHelp, snapshotContext, articleSummaries);
  }

  // Fallback: knowledge-base powered response
  return NextResponse.json({
    response: generateLocalResponse(message, route || "/dashboard", snapshot),
  });
}

async function handleOpenAI(
  apiKey: string,
  message: string,
  route: string,
  pageHelp: string,
  snapshot: string,
  articles: string,
) {
  try {
    const systemPrompt = buildSystemPrompt({
      currentRoute: route || "/dashboard",
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

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
    return NextResponse.json({ response: reply });
  } catch {
    return NextResponse.json({ response: "AI service is temporarily unavailable. Please try again." });
  }
}

async function handleAnthropic(
  apiKey: string,
  message: string,
  route: string,
  pageHelp: string,
  snapshot: string,
  articles: string,
) {
  try {
    const systemPrompt = buildSystemPrompt({
      currentRoute: route || "/dashboard",
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

    const data = await res.json();
    const reply = data.content?.[0]?.text ?? "I couldn't generate a response. Please try again.";
    return NextResponse.json({ response: reply });
  } catch {
    return NextResponse.json({ response: "AI service is temporarily unavailable. Please try again." });
  }
}

function generateLocalResponse(
  message: string,
  route: string,
  snapshot: GuidanceSnapshot,
): string {
  const q = message.toLowerCase();

  // "What should I do next?" / setup help
  if (q.includes("next") || q.includes("set up") || q.includes("get started") || q.includes("first")) {
    const incomplete = checklistItems.filter((item) => !item.isComplete(snapshot));
    if (incomplete.length === 0) {
      return "Your setup looks complete! You have products, images, service areas, orders, payments, and documents configured. You're ready to take real bookings. Consider sharing your storefront link with potential customers.";
    }
    const next = incomplete[0];
    const remaining = incomplete.length;
    return `**Next step: ${next.title}**\n\n${next.description}\n\nGo to [${next.href}](${next.href}) to complete this step. You have ${remaining} remaining setup task${remaining > 1 ? "s" : ""}.`;
  }

  // "Explain this page"
  if (q.includes("explain") && (q.includes("page") || q.includes("this"))) {
    const help = pageHelpMap[route];
    if (help) {
      return `**${help.title}**\n\n${help.description}`;
    }
    return "This is a dashboard page in RentalOS. Use the sidebar to navigate between sections like Orders, Products, Payments, and more.";
  }

  // Search help articles for relevant content
  const relevantArticles = searchArticles(message);
  if (relevantArticles.length > 0) {
    const best = relevantArticles[0];
    // Extract the first meaningful paragraph from the body
    const firstPara = best.body.split("\n\n").slice(0, 2).join("\n\n");
    return `**${best.title}**\n\n${firstPara}\n\nFor the full guide, visit the Help Center article: [${best.title}](/dashboard/help/${best.slug})`;
  }

  // "How do I record a payment?"
  if (q.includes("payment") || q.includes("deposit") || q.includes("pay")) {
    return "To record a payment, go to **Payments** in the sidebar or open a specific order. Select the order, enter the amount, choose a payment method (Cash, Check, Venmo, Zelle, Card, or Other), and optionally add a reference note. Orders auto-confirm when fully paid.\n\nSee the full guide: [Recording payments](/dashboard/help/recording-payments)";
  }

  // "order" related
  if (q.includes("order") || q.includes("booking")) {
    return "To create an order, go to **Orders** > **Create New Order**. Select a customer, choose an event date, add products, and pick a delivery service area. Orders move from Inquiry → Confirmed → Delivered → Completed.\n\nSee the full guide: [Creating orders](/dashboard/help/creating-orders)";
  }

  // Default
  return "I can help you with:\n\n- **Getting set up** — Ask \"What should I do next?\"\n- **Page explanations** — Ask \"Explain this page\"\n- **How-to questions** — Ask about orders, payments, products, deliveries, or documents\n- **Troubleshooting** — Ask about specific issues you're experiencing\n\nTry one of the suggested prompts below, or ask me a specific question about your rental business platform.";
}

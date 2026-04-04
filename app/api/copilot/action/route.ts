import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import { getCopilotAccessContext } from "@/lib/security/copilot-access";
import { executeCopilotAction, type CopilotAction } from "@/lib/copilot/actions";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { revalidatePath } from "next/cache";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const copilotActionSchema = z.object({
  type: z.enum([
    "update_hero",
    "update_service_area_text",
    "update_booking_message",
    "update_faq",
    "update_about",
    "generate_content",
  ]),
  field: z.string().min(1).max(100),
  value: z.string().min(1).max(10000),
  preview: z.string().max(500).optional().default(""),
});

function jsonResponse(
  body: Record<string, unknown>,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) {
    await logAppError({
      source: "copilot.action",
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
      source: "copilot.action",
      message: "Rejected unauthenticated Copilot action",
      route: request.nextUrl.pathname,
    });
    return jsonResponse(
      { error: "You must be signed in to use Copilot." },
      { status: 401 }
    );
  }

  // Rate limiting: 30 per 15 min per user
  const { allowed } = await enforceRateLimit({
    scope: "api:copilot:action:user",
    actor: access.userId,
    limit: 30,
    windowSeconds: 900,
  });

  if (!allowed) {
    return jsonResponse(
      { error: "Too many requests. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = copilotActionSchema.safeParse(requestBody);
  if (!parsed.success) {
    await logAppError({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.action",
      message: "Invalid Copilot action payload",
      route: request.nextUrl.pathname,
      context: {
        issue: parsed.error.issues[0]?.message,
      },
    });
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Invalid action." },
      { status: 400 }
    );
  }

  const action: CopilotAction = parsed.data;

  try {
    const result = await executeCopilotAction(action, access.organizationId);

    if (result.ok) {
      revalidatePath("/dashboard/website");

      await logAppEvent({
        organizationId: access.organizationId,
        userId: access.userId,
        source: "copilot.action",
        action: "action_executed",
        status: "success",
        route: "/dashboard/website",
        metadata: {
          actionType: action.type,
          field: action.field,
        },
      });
    }

    return jsonResponse(result);
  } catch (error) {
    await logAppError({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.action",
      message: "Copilot action execution failed",
      route: request.nextUrl.pathname,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return jsonResponse(
      { ok: false, message: "Failed to execute action. Please try again." },
      { status: 500 }
    );
  }
}

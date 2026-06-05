import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import {
  getCopilotAccessContext,
  copilotRoleAllowed,
  COPILOT_ACTION_ROLES,
} from "@/lib/security/copilot-access";
import { executeCopilotAction, type CopilotAction } from "@/lib/copilot/actions";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { revalidatePath } from "next/cache";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrustedClientIp } from "@/lib/security/request-client";
import {
  hasAcknowledgedCopilotActions,
  COPILOT_ACTIONS_TERMS_VERSION,
  COPILOT_ACTIONS_TERMS,
} from "@/lib/copilot/acknowledgment";

export const runtime = "nodejs";

const contentActionSchema = z.object({
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

const paymentActionSchema = z.object({
  type: z.literal("record_payment"),
  preview: z.string().max(500).optional().default(""),
  params: z.object({
    orderId: z.string().uuid("Invalid order identifier."),
    amount: z
      .number()
      .positive("Amount must be greater than zero.")
      .max(100000, "Amount is too large."),
    paymentType: z.enum(["deposit", "balance", "partial"]),
    paymentMethod: z.enum([
      "cash",
      "check",
      "card_manual",
      "venmo",
      "zelle",
      "other",
    ]),
    referenceNote: z.string().max(120).optional(),
  }),
});

const orderStatusActionSchema = z.object({
  type: z.literal("update_order_status"),
  preview: z.string().max(500).optional().default(""),
  params: z.object({
    orderId: z.string().uuid("Invalid order identifier."),
    // Non-destructive forward statuses only; cancelled/refunded stay manual.
    newStatus: z.enum([
      "quote_sent",
      "awaiting_deposit",
      "confirmed",
      "scheduled",
      "out_for_delivery",
      "delivered",
      "completed",
    ]),
  }),
});

const generateDocumentsActionSchema = z.object({
  type: z.literal("generate_documents"),
  preview: z.string().max(500).optional().default(""),
  params: z.object({
    orderId: z.string().uuid("Invalid order identifier."),
  }),
});

const sendQuoteActionSchema = z.object({
  type: z.literal("send_quote"),
  preview: z.string().max(500).optional().default(""),
  params: z.object({
    orderId: z.string().uuid("Invalid order identifier."),
  }),
});

const sendReplyActionSchema = z.object({
  type: z.literal("send_reply"),
  preview: z.string().max(500).optional().default(""),
  params: z.object({
    body: z.string().trim().min(1, "Reply cannot be empty.").max(5000),
    customerEmail: z.string().email("Valid customer email required."),
    customerId: z.string().uuid().nullish(),
    orderId: z.string().uuid().nullish(),
    orderNumber: z.string().max(100).nullish(),
  }),
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

  // Captured for the audit trail (non-repudiation) on any executed action.
  const clientIp = getTrustedClientIp(request.headers);
  const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? null;

  // Copilot actions mutate org-wide settings and records — restrict to owners
  // and admins. access.role is resolved against the active-org cookie, the same
  // org the delegated server actions (recordPayment, updateOrderStatus, …)
  // operate on, so the gate and the execution can't disagree on tenant.
  if (!copilotRoleAllowed(access.role, COPILOT_ACTION_ROLES)) {
    return jsonResponse({ error: "Only owners and admins can modify organization settings." }, { status: 403 });
  }

  // Used below for the one-time acknowledgment lookup/gate.
  const copilotSupabase = await createSupabaseServerClient();

  // Rate limiting: 30 per 15 min per user
  let allowed: boolean;
  try {
    ({ allowed } = await enforceRateLimit({
      scope: "api:copilot:action:user",
      actor: access.userId,
      limit: 30,
      windowSeconds: 900,
    }));
  } catch {
    return jsonResponse({ error: "Service temporarily unavailable." }, { status: 503 });
  }

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

  // Pick the schema by discriminator so error messages stay precise.
  const requestType =
    typeof requestBody === "object" && requestBody !== null
      ? (requestBody as { type?: unknown }).type
      : undefined;
  const parsed =
    requestType === "record_payment"
      ? paymentActionSchema.safeParse(requestBody)
      : requestType === "update_order_status"
        ? orderStatusActionSchema.safeParse(requestBody)
        : requestType === "generate_documents"
          ? generateDocumentsActionSchema.safeParse(requestBody)
          : requestType === "send_reply"
            ? sendReplyActionSchema.safeParse(requestBody)
            : requestType === "send_quote"
              ? sendQuoteActionSchema.safeParse(requestBody)
              : contentActionSchema.safeParse(requestBody);
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

  // One-time acknowledgment gate: before the operator's first Copilot action,
  // they must accept the AI-assistance terms. Backstops the client gate; fails
  // open only when the acknowledgment table isn't provisioned yet, so the
  // existing feature never hard-breaks while the migration is pending.
  const ack = await hasAcknowledgedCopilotActions(
    copilotSupabase,
    access.organizationId,
    access.userId,
    COPILOT_ACTIONS_TERMS_VERSION
  );
  if (ack.provisioned && !ack.acknowledged) {
    return jsonResponse({
      ok: false,
      needsAcknowledgment: true,
      version: COPILOT_ACTIONS_TERMS_VERSION,
      terms: COPILOT_ACTIONS_TERMS,
    });
  }

  try {
    const result = await executeCopilotAction(action);

    if (result.ok) {
      if (action.type === "record_payment") {
        // recordPayment already revalidates payments/order/dashboard; refresh
        // the dashboard's operational figures the Copilot reads from too.
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/payments");

        await logAppEvent({
          organizationId: access.organizationId,
          userId: access.userId,
          source: "copilot.action",
          action: "action_executed",
          status: "success",
          route: "/dashboard/payments",
          metadata: {
            actionType: action.type,
            orderId: action.params.orderId,
            amount: action.params.amount,
            paymentType: action.params.paymentType,
            paymentMethod: action.params.paymentMethod,
            ip: clientIp,
            userAgent,
          },
        });
      } else if (action.type === "update_order_status") {
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/orders");
        revalidatePath(`/dashboard/orders/${action.params.orderId}`);

        await logAppEvent({
          organizationId: access.organizationId,
          userId: access.userId,
          source: "copilot.action",
          action: "action_executed",
          status: "success",
          route: "/dashboard/orders",
          metadata: {
            actionType: action.type,
            orderId: action.params.orderId,
            newStatus: action.params.newStatus,
            ip: clientIp,
            userAgent,
          },
        });
      } else if (action.type === "generate_documents") {
        revalidatePath("/dashboard/documents");
        revalidatePath(`/dashboard/orders/${action.params.orderId}`);

        await logAppEvent({
          organizationId: access.organizationId,
          userId: access.userId,
          source: "copilot.action",
          action: "action_executed",
          status: "success",
          route: "/dashboard/documents",
          metadata: {
            actionType: action.type,
            orderId: action.params.orderId,
            ip: clientIp,
            userAgent,
          },
        });
      } else if (action.type === "send_quote") {
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/orders");
        revalidatePath(`/dashboard/orders/${action.params.orderId}`);

        await logAppEvent({
          organizationId: access.organizationId,
          userId: access.userId,
          source: "copilot.action",
          action: "action_executed",
          status: "success",
          route: "/dashboard/orders",
          metadata: {
            actionType: action.type,
            orderId: action.params.orderId,
            ip: clientIp,
            userAgent,
          },
        });
      } else if (action.type === "send_reply") {
        revalidatePath("/dashboard/messages");

        await logAppEvent({
          organizationId: access.organizationId,
          userId: access.userId,
          source: "copilot.action",
          action: "action_executed",
          status: "success",
          route: "/dashboard/messages",
          // Don't store the full customer-facing body here (it's already in the
          // messages table + communications log); keep a length + recipient.
          metadata: {
            actionType: action.type,
            customerEmail: action.params.customerEmail,
            orderId: action.params.orderId ?? null,
            bodyLength: action.params.body.length,
            ip: clientIp,
            userAgent,
          },
        });
      } else {
        revalidatePath("/dashboard/website");
        revalidatePath("/");

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
            ip: clientIp,
            userAgent,
          },
        });
      }
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
      error,
    });

    return jsonResponse(
      { ok: false, message: "Failed to execute action. Please try again." },
      { status: 500 }
    );
  }
}

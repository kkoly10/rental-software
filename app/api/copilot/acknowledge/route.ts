import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import {
  getCopilotAccessContext,
  copilotRoleAllowed,
  COPILOT_ACTION_ROLES,
} from "@/lib/security/copilot-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrustedClientIp } from "@/lib/security/request-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import {
  COPILOT_ACTIONS_TERMS,
  COPILOT_ACTIONS_TERMS_VERSION,
  hasAcknowledgedCopilotActions,
  recordCopilotActionAcknowledgment,
} from "@/lib/copilot/acknowledgment";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// Whether the operator still needs to accept the current terms version, plus
// the terms text to display.
export async function GET() {
  const access = await getCopilotAccessContext();
  if (!access) {
    return jsonResponse(
      { error: "You must be signed in to use Copilot." },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const ack = await hasAcknowledgedCopilotActions(
    supabase,
    access.organizationId,
    access.userId,
    COPILOT_ACTIONS_TERMS_VERSION
  );

  return jsonResponse({
    acknowledged: ack.acknowledged,
    version: COPILOT_ACTIONS_TERMS_VERSION,
    terms: COPILOT_ACTIONS_TERMS,
  });
}

const acknowledgeSchema = z.object({
  version: z.string().min(1).max(40),
});

export async function POST(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) {
    return jsonResponse({ error: "Invalid request origin." }, { status: 403 });
  }

  const access = await getCopilotAccessContext();
  if (!access) {
    return jsonResponse(
      { error: "You must be signed in to use Copilot." },
      { status: 401 }
    );
  }

  // Acknowledgment is only meaningful for roles that can take actions.
  if (!copilotRoleAllowed(access.role, COPILOT_ACTION_ROLES)) {
    return jsonResponse(
      { error: "Only owners and admins can modify organization settings." },
      { status: 403 }
    );
  }

  try {
    const { allowed } = await enforceRateLimit({
      scope: "api:copilot:acknowledge:user",
      actor: access.userId,
      limit: 20,
      windowSeconds: 900,
    });
    if (!allowed) {
      return jsonResponse(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }
  } catch {
    return jsonResponse({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = acknowledgeSchema.safeParse(body);
  // Always record against the server's current version, ignoring a stale
  // client version, so the stored acknowledgment matches the live terms.
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const clientIp = getTrustedClientIp(request.headers);
  const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? null;

  const supabase = await createSupabaseServerClient();
  const result = await recordCopilotActionAcknowledgment(
    supabase,
    access.organizationId,
    access.userId,
    COPILOT_ACTIONS_TERMS_VERSION,
    clientIp,
    userAgent
  );

  if (!result.ok) {
    await logAppError({
      organizationId: access.organizationId,
      userId: access.userId,
      source: "copilot.acknowledge",
      message: "Failed to record Copilot action acknowledgment",
      route: request.nextUrl.pathname,
    });
    return jsonResponse(
      { error: "Couldn't record your acknowledgment. Please try again." },
      { status: 500 }
    );
  }

  await logAppEvent({
    organizationId: access.organizationId,
    userId: access.userId,
    source: "copilot.acknowledge",
    action: "terms_acknowledged",
    status: "success",
    route: request.nextUrl.pathname,
    metadata: {
      version: COPILOT_ACTIONS_TERMS_VERSION,
      ip: clientIp,
      userAgent,
      provisioned: result.provisioned,
    },
  });

  return jsonResponse({ ok: true, version: COPILOT_ACTIONS_TERMS_VERSION });
}

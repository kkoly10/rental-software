import { NextRequest, NextResponse } from "next/server";
import { clientErrorReportSchema } from "@/lib/validation/observability";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import { getRequestClientKey } from "@/lib/security/request-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAppError } from "@/lib/observability/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = clientErrorReportSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client error report." }, { status: 400 });
  }

  try {
    const clientKey = getRequestClientKey(request);
    const limit = await enforceRateLimit({
      scope: "client-error:client",
      actor: clientKey,
      limit: 20,
      windowSeconds: 300,
    });

    if (!limit.allowed) {
      return NextResponse.json({ ok: true }, { status: 202 });
    }
  } catch {
    // Fail open for client error logging.
  }

  await logAppError({
    source: parsed.data.source,
    message: parsed.data.message,
    route: parsed.data.route ?? null,
    stack: parsed.data.stack ?? null,
    context: {
      digest: parsed.data.digest,
      userAgent: parsed.data.userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

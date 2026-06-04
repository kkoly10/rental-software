import { NextResponse } from "next/server";
import { getCopilotAccessContext } from "@/lib/security/copilot-access";
import { getOperationalSnapshot } from "@/lib/data/operational-snapshot";
import { buildDailyBriefing } from "@/lib/copilot/briefing";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// Proactive daily briefing — a deterministic "what needs my attention" roundup
// shown when the Copilot panel opens. Read-only.
export async function GET() {
  const access = await getCopilotAccessContext();
  if (!access) {
    return jsonResponse(
      { error: "You must be signed in to use Copilot." },
      { status: 401 }
    );
  }

  try {
    const { allowed } = await enforceRateLimit({
      scope: "api:copilot:briefing:user",
      actor: access.userId,
      limit: 60,
      windowSeconds: 900,
    });
    if (!allowed) {
      // Soft-fail: no briefing rather than an error banner in the panel.
      return jsonResponse({ briefing: null });
    }
  } catch {
    return jsonResponse({ briefing: null });
  }

  const snapshot = await getOperationalSnapshot();
  return jsonResponse({ briefing: buildDailyBriefing(snapshot) });
}

import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Rate limiting: 60 per minute per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await enforceRateLimit({
    scope: "api:health:ip",
    actor: clientIp,
    limit: 60,
    windowSeconds: 60,
  });

  if (!allowed) {
    return NextResponse.json(
      { status: "error", message: "Too many requests." },
      { status: 429 }
    );
  }

  const checks: Record<string, "ok" | "missing" | "error"> = {
    env_supabase: hasSupabaseEnv() ? "ok" : "missing",
    env_site_url: process.env.NEXT_PUBLIC_SITE_URL ? "ok" : "missing",
  };

  // DB connectivity check
  if (hasSupabaseEnv()) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.from("organizations").select("id").limit(1);
      checks.database = error ? "error" : "ok";
    } catch {
      checks.database = "error";
    }
  } else {
    checks.database = "missing";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { isSlugAvailable, isValidSlugFormat } from "@/lib/auth/resolve-org";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-client";

export async function GET(request: NextRequest) {
  // Rate limiting: 20 per 15 min per IP
  const clientIp = getTrustedClientIp(request.headers);
  let allowed: boolean;
  try {
    ({ allowed } = await enforceRateLimit({
      scope: "api:domains:check-slug:ip",
      actor: clientIp,
      limit: 20,
      windowSeconds: 900,
    }));
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const slug = request.nextUrl.searchParams.get("slug") ?? "";

  if (!isValidSlugFormat(slug)) {
    return NextResponse.json({ available: false, reason: "Invalid format" });
  }

  const available = await isSlugAvailable(slug);
  return NextResponse.json({ available });
}

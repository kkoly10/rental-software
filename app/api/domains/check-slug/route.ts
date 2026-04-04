import { NextRequest, NextResponse } from "next/server";
import { isSlugAvailable, isValidSlugFormat } from "@/lib/auth/resolve-org";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limiting: 20 per 15 min per IP
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await enforceRateLimit({
    scope: "api:domains:check-slug:ip",
    actor: clientIp,
    limit: 20,
    windowSeconds: 900,
  });

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

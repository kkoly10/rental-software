import { NextRequest, NextResponse } from "next/server";
import { isSlugAvailable, isValidSlugFormat } from "@/lib/auth/resolve-org";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";

  if (!isValidSlugFormat(slug)) {
    return NextResponse.json({ available: false, reason: "Invalid format" });
  }

  const available = await isSlugAvailable(slug);
  return NextResponse.json({ available });
}

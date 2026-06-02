import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { getPullSheetData } from "@/lib/logistics/pull-sheet";
import { generatePullSheetPdf } from "@/lib/logistics/generate-pull-sheet-pdf";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { safeFilenameToken } from "@/lib/security/header-safe";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit mirrors invoice download (10 per 15 min per user) — pull
  // sheets aren't financially sensitive, but they do trigger a database
  // join + PDF render so we keep the same envelope.
  let allowed: boolean;
  try {
    ({ allowed } = await enforceRateLimit({
      scope: "api:pull-sheet:user",
      actor: ctx.userId,
      limit: 10,
      windowSeconds: 900,
    }));
  } catch {
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503 }
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  const data = await getPullSheetData(id);
  if (!data) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const pdfBytes = generatePullSheetPdf(data);
  const buffer = Buffer.from(pdfBytes);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pull-sheet-${safeFilenameToken(data.routeName)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

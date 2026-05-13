import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth/org-context";

export async function GET() {
  const ctx = await getOrgContext();
  return NextResponse.json(
    { businessType: ctx?.businessType ?? "inflatable" },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}

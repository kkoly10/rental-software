import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth/org-context";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ businessType: "inflatable" });
  }
  return NextResponse.json({ businessType: ctx.businessType });
}

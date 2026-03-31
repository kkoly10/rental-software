import { NextResponse } from "next/server";
import { getCopilotAccessContext } from "@/lib/security/copilot-access";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FIELDS = [
  "hero_message",
  "service_area_text",
  "booking_message",
  "custom_faq",
  "about_text",
] as const;

export async function GET() {
  const access = await getCopilotAccessContext();
  if (!access) {
    return NextResponse.json(
      { error: "You must be signed in to use Copilot." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!hasSupabaseEnv()) {
    // Demo mode – return empty values
    const empty: Record<string, string> = {};
    for (const f of FIELDS) empty[f] = "";
    return NextResponse.json(empty, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", access.organizationId)
    .maybeSingle();

  const settings = (org?.settings as Record<string, unknown>) ?? {};

  const result: Record<string, string> = {};
  for (const field of FIELDS) {
    const val = settings[field];
    if (val === undefined || val === null) {
      result[field] = "";
    } else if (typeof val === "string") {
      result[field] = val;
    } else {
      // For objects/arrays (e.g. custom_faq), serialize to JSON string
      result[field] = JSON.stringify(val);
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

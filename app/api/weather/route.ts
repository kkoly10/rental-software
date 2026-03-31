import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWeatherForZip } from "@/lib/weather/api";

const querySchema = z.object({
  zip: z
    .string()
    .regex(/^\d{5}$/, "ZIP code must be 5 digits"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse({
    zip: searchParams.get("zip") ?? "",
    date: searchParams.get("date") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const forecast = await getWeatherForZip(parsed.data.zip, parsed.data.date);

  if (!forecast) {
    return NextResponse.json(
      { error: "Weather data unavailable for the requested date or location" },
      { status: 404 }
    );
  }

  return NextResponse.json(forecast, {
    headers: {
      "Cache-Control": "public, max-age=1800",
    },
  });
}

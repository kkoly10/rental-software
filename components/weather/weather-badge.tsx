"use client";

import { useEffect, useState } from "react";
import type { WeatherForecast } from "@/lib/weather/api";

export function WeatherBadge({
  eventDate,
  zipCode,
  compact = false,
}: {
  eventDate: string;
  zipCode?: string;
  compact?: boolean;
}) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);

  useEffect(() => {
    if (!zipCode || !eventDate) return;

    const parsed = parseDate(eventDate);
    if (!parsed) return;

    const controller = new AbortController();
    fetch(`/api/weather?zip=${encodeURIComponent(zipCode)}&date=${parsed}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setForecast(data);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [eventDate, zipCode]);

  if (!forecast) return null;

  const icon =
    forecast.riskLevel === "high"
      ? "\u26A0\uFE0F"
      : forecast.riskLevel === "moderate"
        ? "\uD83C\uDF27\uFE0F"
        : "\u2600\uFE0F";

  const riskLabel =
    forecast.riskLevel === "high"
      ? "High risk"
      : forecast.riskLevel === "moderate"
        ? "Moderate"
        : "Clear";

  if (compact) {
    return (
      <span className={`weather-badge weather-badge-${forecast.riskLevel}`}>
        {icon} {riskLabel}
      </span>
    );
  }

  return (
    <span className={`weather-badge weather-badge-${forecast.riskLevel}`}>
      {icon} {forecast.tempLow}&deg;&ndash;{forecast.tempHigh}&deg;F &middot;{" "}
      {forecast.precipitationChance}% precip
    </span>
  );
}

function parseDate(input: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

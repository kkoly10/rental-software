"use client";

import { useEffect, useState } from "react";
import type { WeatherForecast } from "@/lib/weather/api";

export function WeatherAlert({
  eventDate,
  zipCode,
}: {
  eventDate: string;
  zipCode?: string;
}) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zipCode || !eventDate) {
      setLoading(false);
      return;
    }

    // Parse the event date to YYYY-MM-DD format
    const parsed = parseDate(eventDate);
    if (!parsed) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/weather?zip=${encodeURIComponent(zipCode)}&date=${parsed}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setForecast(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [eventDate, zipCode]);

  if (loading || !forecast) return null;

  const icon =
    forecast.riskLevel === "high"
      ? "\u26A0\uFE0F"
      : forecast.riskLevel === "moderate"
        ? "\uD83C\uDF27\uFE0F"
        : "\u2600\uFE0F";

  const message =
    forecast.riskLevel === "high"
      ? "Weather alert \u2014 high winds or storms forecasted, consider rescheduling"
      : forecast.riskLevel === "moderate"
        ? "Some weather concerns \u2014 rain possible, consider backup plans"
        : "Clear skies expected \u2014 great day for an event!";

  return (
    <div className={`weather-alert weather-alert-${forecast.riskLevel}`}>
      <div className="weather-alert-header">
        <span className="weather-alert-icon">{icon}</span>
        <span className="weather-alert-message">{message}</span>
      </div>
      <div className="weather-details">
        <div className="weather-stat">
          <span className="weather-stat-label">Temperature</span>
          <span className="weather-stat-value">
            {forecast.tempLow}&deg;F &ndash; {forecast.tempHigh}&deg;F
          </span>
        </div>
        <div className="weather-stat">
          <span className="weather-stat-label">Precipitation</span>
          <span className="weather-stat-value">
            {forecast.precipitationChance}%
          </span>
        </div>
        <div className="weather-stat">
          <span className="weather-stat-label">Wind</span>
          <span className="weather-stat-value">{forecast.windSpeed} mph</span>
        </div>
      </div>
      <div className="weather-description">{forecast.description}</div>
    </div>
  );
}

/** Parse dates like "May 24, 2026" or "2026-05-24" into YYYY-MM-DD */
function parseDate(input: string): string | null {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

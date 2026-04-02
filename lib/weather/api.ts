import { geocodeZipServer } from "@/lib/maps/geocode-server";

export type WeatherForecast = {
  date: string;
  tempHigh: number;
  tempLow: number;
  precipitationChance: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  riskLevel: "low" | "moderate" | "high";
};

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function getDescription(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] ?? "Unknown";
}

function assessRisk(
  weatherCode: number,
  windSpeed: number,
  precipitationChance: number
): "low" | "moderate" | "high" {
  // High risk: thunderstorms (95+), heavy snow (75+), heavy rain (65+),
  // high wind (>25mph), or heavy precip chance (>60%)
  if (weatherCode >= 95) return "high";
  if (weatherCode >= 75) return "high";
  if (weatherCode === 65 || weatherCode === 67 || weatherCode === 82)
    return "high";
  if (windSpeed > 25) return "high";
  if (precipitationChance > 60) return "high";

  // Moderate risk: fog/drizzle/rain codes (45-67), moderate wind (15-25),
  // some precip (30-60%), or snow codes 71-73
  if (weatherCode >= 45 && weatherCode <= 67) return "moderate";
  if (weatherCode === 71 || weatherCode === 73) return "moderate";
  if (windSpeed >= 15 && windSpeed <= 25) return "moderate";
  if (precipitationChance >= 30 && precipitationChance <= 60) return "moderate";

  return "low";
}

export async function getWeatherForecast(
  lat: number,
  lng: number,
  date: string
): Promise<WeatherForecast | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York`;

    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const data = await res.json();
    const daily = data.daily;
    if (!daily || !daily.time) return null;

    const dayIndex = daily.time.indexOf(date);
    if (dayIndex === -1) return null;

    const tempHigh = daily.temperature_2m_max[dayIndex];
    const tempLow = daily.temperature_2m_min[dayIndex];
    const precipitationChance = daily.precipitation_probability_max[dayIndex];
    const windSpeed = daily.wind_speed_10m_max[dayIndex];
    const weatherCode = daily.weather_code[dayIndex];

    return {
      date,
      tempHigh: Math.round(tempHigh),
      tempLow: Math.round(tempLow),
      precipitationChance,
      windSpeed: Math.round(windSpeed),
      weatherCode,
      description: getDescription(weatherCode),
      riskLevel: assessRisk(weatherCode, windSpeed, precipitationChance),
    };
  } catch {
    return null;
  }
}

export async function getWeatherForZip(
  zip: string,
  date: string
): Promise<WeatherForecast | null> {
  const coords = await geocodeZipServer(zip);
  if (!coords) return null;
  return getWeatherForecast(coords.lat, coords.lng, date);
}

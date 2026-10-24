import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { PlaceResult, WeatherNow } from "@/lib/types";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

const current = z.object({
  time: z.string(),
  temperature_2m: z.number().nullable().optional(),
  apparent_temperature: z.number().nullable().optional(),
  relative_humidity_2m: z.number().nullable().optional(),
  wind_speed_10m: z.number().nullable().optional(),
  wind_direction_10m: z.number().nullable().optional(),
  wind_gusts_10m: z.number().nullable().optional(),
  precipitation: z.number().nullable().optional(),
  cloud_cover: z.number().nullable().optional(),
  weather_code: z.number().nullable().optional(),
  is_day: z.number().nullable().optional(),
});

/** Current conditions from Open-Meteo's blended forecast models (modelled, not a station reading). */
export async function loadWeather(lat: number, lon: number): Promise<WeatherNow> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,weather_code,is_day",
    timezone: "GMT",
  });
  const body = z
    .object({ latitude: z.number(), longitude: z.number(), current })
    .parse(await fetchJson(`${FORECAST}?${params}`, { timeoutMs: 10_000, retries: 1 }));
  const c = body.current;
  return {
    lat: body.latitude,
    lon: body.longitude,
    validAt: new Date(`${c.time}Z`).toISOString(),
    temperatureC: c.temperature_2m ?? null,
    apparentC: c.apparent_temperature ?? null,
    humidityPct: c.relative_humidity_2m ?? null,
    windKmh: c.wind_speed_10m ?? null,
    windDirDeg: c.wind_direction_10m ?? null,
    gustKmh: c.wind_gusts_10m ?? null,
    precipitationMm: c.precipitation ?? null,
    cloudCoverPct: c.cloud_cover ?? null,
    weatherCode: c.weather_code ?? null,
    isDay: c.is_day === null || c.is_day === undefined ? null : c.is_day === 1,
    retrievedAt: new Date().toISOString(),
  };
}

const place = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  feature_code: z.string().optional(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  population: z.number().optional(),
});

/** Camera height that frames a place by its kind and size. */
function viewHeightFor(featureCode: string | undefined, population: number | undefined) {
  if (featureCode?.startsWith("PCL")) return 3_500_000;
  if (featureCode?.startsWith("ADM1")) return 1_200_000;
  if ((population ?? 0) > 5_000_000) return 120_000;
  if ((population ?? 0) > 500_000) return 60_000;
  return 30_000;
}

export async function geocode(query: string, language = "en"): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ name: query, count: "8", language, format: "json" });
  const body = z
    .object({ results: z.array(z.unknown()).optional() })
    .parse(await fetchJson(`${GEOCODE}?${params}`, { timeoutMs: 8_000, retries: 1 }));
  return (body.results ?? []).flatMap((raw) => {
    const p = place.safeParse(raw);
    if (!p.success) return [];
    const r = p.data;
    const country = r.feature_code?.startsWith("PCL");
    return [
      {
        id: `geonames:${r.id}`,
        name: r.name,
        context: country ? "Country" : [r.admin1, r.country].filter(Boolean).join(", "),
        kind: country ? "country" : "place",
        lon: r.longitude,
        lat: r.latitude,
        viewHeight: viewHeightFor(r.feature_code, r.population),
      } satisfies PlaceResult,
    ];
  });
}

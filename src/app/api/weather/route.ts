import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadWeather } from "@/server/providers/openmeteo";
import { recordDirectCall } from "@/server/sources";
import { jsonError, rateLimit } from "@/server/rate-limit";
import { TtlCache } from "@/server/lru";
import type { WeatherNow } from "@/lib/types";

const cache = new TtlCache<WeatherNow>(2000, 10 * 60_000);
const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("lat and lon are required and must be valid coordinates.", 400);
  // Round to ~10 km so nearby clicks share a cache entry and upstream load stays small.
  const lat = Math.round(parsed.data.lat * 10) / 10;
  const lon = Math.round(parsed.data.lon * 10) / 10;
  const key = `${lat},${lon}`;

  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached);

  const limited = rateLimit(request, "weather", 40);
  if (limited) return limited;

  try {
    const weather = await loadWeather(lat, lon);
    cache.set(key, weather);
    recordDirectCall("openmeteo", null);
    return NextResponse.json(weather, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch {
    recordDirectCall("openmeteo", "Weather could not be loaded from Open-Meteo");
    return jsonError("Weather is unavailable right now.", 502);
  }
}

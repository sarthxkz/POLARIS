import { NextResponse, type NextRequest } from "next/server";
import { geocode } from "@/server/providers/openmeteo";
import { recordDirectCall } from "@/server/sources";
import { jsonError, rateLimit } from "@/server/rate-limit";
import { TtlCache } from "@/server/lru";
import { formatLatLon, parseCoordinates } from "@/lib/geo";
import type { PlaceResult } from "@/lib/types";

const cache = new TtlCache<PlaceResult[]>(500, 24 * 3_600_000);

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  if (q.length > 120) return jsonError("Search text is too long.", 400);

  const coords = parseCoordinates(q);
  if (coords) {
    const result: PlaceResult = {
      id: `coords:${coords.lat},${coords.lon}`,
      name: formatLatLon(coords.lat, coords.lon, 4),
      context: "Coordinates",
      kind: "coordinates",
      lat: coords.lat,
      lon: coords.lon,
      viewHeight: 400_000,
    };
    return NextResponse.json({ results: [result] });
  }

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached) return NextResponse.json({ results: cached, attribution: "Open-Meteo, GeoNames" });

  const limited = rateLimit(request, "search", 30);
  if (limited) return limited;

  try {
    const results = await geocode(q);
    cache.set(key, results);
    recordDirectCall("openmeteo", null);
    return NextResponse.json(
      { results, attribution: "Open-Meteo, GeoNames" },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    recordDirectCall("openmeteo", "Place search could not reach Open-Meteo");
    return jsonError("Place search is unavailable right now. Coordinates still work, for example 18.52, 73.85.", 502);
  }
}

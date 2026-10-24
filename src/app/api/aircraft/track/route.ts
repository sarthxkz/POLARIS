import { NextResponse, type NextRequest } from "next/server";
import { storedTrack } from "@/server/providers/opensky";
import { jsonError } from "@/server/rate-limit";

/** Positions of one aircraft from the snapshots this server retrieved (in memory, max 8). */
export async function GET(request: NextRequest) {
  const icao24 = request.nextUrl.searchParams.get("icao24") ?? "";
  if (!/^[0-9a-f]{6}$/.test(icao24)) return jsonError("icao24 must be six hex characters.", 400);
  return NextResponse.json({ icao24, samples: storedTrack(icao24) }, { headers: { "Cache-Control": "no-store" } });
}

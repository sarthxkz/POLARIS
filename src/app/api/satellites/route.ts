import { NextResponse } from "next/server";
import { celestrak, healthOf } from "@/server/sources";
import { SATELLITE_GROUPS } from "@/server/providers/celestrak";
import type { SatellitesPayload } from "@/lib/types";

export async function GET() {
  const state = await celestrak.get();
  const satellites = state.data?.satellites ?? [];
  const health = healthOf("celestrak");
  const body: SatellitesPayload = {
    groups: SATELLITE_GROUPS.map((g) => ({ ...g, count: satellites.filter((s) => s.group === g.id).length })),
    satellites,
    // The oldest group's fetch time, so the page never overstates freshness.
    retrievedAt: state.data ? new Date(state.data.oldestFetch).toISOString() : null,
    health: { status: health.status, lastError: health.lastError },
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" },
  });
}

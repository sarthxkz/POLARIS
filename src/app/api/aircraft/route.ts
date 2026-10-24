import { NextResponse } from "next/server";
import { opensky, healthOf } from "@/server/sources";
import { openskyAccess, openskyRefreshSeconds } from "@/server/providers/opensky";
import type { AircraftPayload } from "@/lib/types";

export async function GET() {
  const state = await opensky.get();
  const health = healthOf("opensky");
  const body: AircraftPayload = {
    snapshotTime: state.data?.time ?? null,
    retrievedAt: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
    aircraft: state.data?.aircraft ?? [],
    access: openskyAccess,
    refreshSeconds: openskyRefreshSeconds,
    health: { status: health.status, lastError: health.lastError, nextAttempt: health.nextAttempt },
    simulated: false,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
}

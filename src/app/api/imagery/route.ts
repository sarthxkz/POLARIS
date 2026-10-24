import { NextResponse } from "next/server";
import { gibs } from "@/server/sources";
import type { ImageryTimes } from "@/lib/types";

export async function GET() {
  const state = await gibs.get();
  const body: ImageryTimes = {
    layers: state.data ?? {},
    retrievedAt: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" },
  });
}

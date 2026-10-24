import { NextResponse } from "next/server";
import { allHealth } from "@/server/sources";

export async function GET() {
  return NextResponse.json(
    { sources: allHealth(), generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

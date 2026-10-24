import { NextResponse } from "next/server";
import { allHealth } from "@/server/sources";

/**
 * Liveness of this web server plus a summary of external feeds. The server can be healthy
 * while feeds are not; `feeds` says which, and the HTTP status only reflects the server.
 */
export async function GET() {
  const sources = allHealth();
  const count = (s: string) => sources.filter((x) => x.status === s).length;
  return NextResponse.json(
    {
      server: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      feeds: {
        live: count("live"),
        stale: count("stale"),
        limited: count("limited"),
        down: count("down"),
        idle: count("idle"),
        total: sources.length,
      },
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

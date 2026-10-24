import "server-only";
import { NextResponse } from "next/server";

/**
 * In-memory token bucket per client IP and route. Protects the request-driven upstreams
 * (geocoding, weather) from being drained through us. Fine for one server process; a
 * multi-instance deployment would move this to the reverse proxy or a shared store.
 */
const buckets = ((globalThis as { __polarisBuckets?: Map<string, { tokens: number; at: number }> })
  .__polarisBuckets ??= new Map());

export function clientIp(request: Request) {
  // Trust only the first hop our own reverse proxy sets.
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function rateLimit(request: Request, route: string, perMinute: number) {
  const key = `${route}:${clientIp(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: perMinute, at: now };
  bucket.tokens = Math.min(perMinute, bucket.tokens + ((now - bucket.at) / 60_000) * perMinute);
  bucket.at = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const retry = Math.ceil(((1 - bucket.tokens) / perMinute) * 60);
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (now - b.at > 600_000) buckets.delete(k);
  }
  return null;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

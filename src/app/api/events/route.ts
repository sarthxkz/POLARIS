import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { filterEvents, getEvents } from "@/server/events";
import { jsonError } from "@/server/rate-limit";
import { EVENT_CATEGORIES } from "@/lib/categories";

const query = z.object({
  category: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined))
    .pipe(z.array(z.enum(EVENT_CATEGORIES)).optional()),
  days: z.coerce.number().int().min(1).max(60).optional(),
  status: z.enum(["open", "closed"]).optional(),
  minMagnitude: z.coerce.number().min(0).max(10).optional(),
  bbox: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map(Number) : undefined))
    .pipe(
      z
        .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)])
        .optional(),
    ),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Invalid query parameters.", 400);
  const q = parsed.data;

  const payload = await getEvents();
  const events = filterEvents(payload.events, {
    categories: q.category,
    since: q.days ? new Date(Date.now() - q.days * 86_400_000) : undefined,
    status: q.status,
    minMagnitude: q.minMagnitude,
    bbox: q.bbox,
    limit: q.limit,
  });

  return NextResponse.json(
    { ...payload, events, total: payload.events.length },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" } },
  );
}

import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { EventCategory, EventPoint, NaturalEvent } from "@/lib/types";

const API = "https://eonet.gsfc.nasa.gov/api/v3/events";

const KNOWN: ReadonlySet<string> = new Set<EventCategory>([
  "wildfires",
  "severeStorms",
  "volcanoes",
  "earthquakes",
  "seaLakeIce",
  "floods",
  "landslides",
  "dustHaze",
  "drought",
  "snow",
  "tempExtremes",
  "waterColor",
  "manmade",
]);

const position = z.tuple([z.number(), z.number()]).rest(z.number());

const geometry = z.object({
  date: z.string(),
  type: z.string(),
  coordinates: z.unknown(),
  magnitudeValue: z.number().nullable().optional(),
  magnitudeUnit: z.string().nullable().optional(),
});

const event = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  link: z.string(),
  closed: z.string().nullable(),
  categories: z.array(z.object({ id: z.string(), title: z.string() })).min(1),
  sources: z.array(z.object({ id: z.string(), url: z.string() })).default([]),
  geometry: z.array(geometry),
});

const response = z.object({ events: z.array(z.unknown()) });

/** Centroid of the outer ring; good enough to place a marker for a fire or ice polygon. */
function ringCentroid(ring: [number, number][]): [number, number] {
  let lon = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lon += x;
    lat += y;
  }
  return [lon / ring.length, lat / ring.length];
}

function toPoint(g: z.infer<typeof geometry>): { point: EventPoint; approximate: boolean } | null {
  const magnitude = g.magnitudeValue ?? null;
  if (g.type === "Point") {
    const parsed = position.safeParse(g.coordinates);
    if (!parsed.success) return null;
    const [lon, lat] = parsed.data;
    return { point: { lon, lat, time: new Date(g.date).toISOString(), magnitude }, approximate: false };
  }
  if (g.type === "Polygon") {
    const ring = z.array(z.array(position)).safeParse(g.coordinates);
    const outer = ring.success ? ring.data[0] : undefined;
    if (!outer || outer.length === 0) return null;
    const [lon, lat] = ringCentroid(outer.map(([x, y]) => [x, y]));
    return { point: { lon, lat, time: new Date(g.date).toISOString(), magnitude }, approximate: true };
  }
  return null;
}

export function normalizeEonetEvent(raw: unknown): NaturalEvent | null {
  const parsed = event.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  const categoryId = e.categories[0]!.id;
  if (!KNOWN.has(categoryId)) return null;

  const samples = e.geometry
    .map(toPoint)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.point.time.localeCompare(b.point.time));
  const latest = samples.at(-1);
  if (!latest) return null;

  const unit = e.geometry.at(-1)?.magnitudeUnit ?? null;
  return {
    id: `eonet:${e.id}`,
    provider: "eonet",
    providerEventId: e.id,
    title: e.title.trim(),
    category: categoryId as EventCategory,
    lon: latest.point.lon,
    lat: latest.point.lat,
    approximate: latest.approximate,
    track: samples.map((s) => s.point),
    startedAt: samples[0]!.point.time,
    observedAt: latest.point.time,
    providerUpdatedAt: null,
    status: e.closed ? "closed" : "open",
    magnitude:
      latest.point.magnitude !== null && unit
        ? { value: latest.point.magnitude, unit }
        : null,
    description: e.description?.trim() || null,
    links: [
      { label: "EONET record", url: e.link },
      ...e.sources.map((s) => ({ label: `Source: ${s.id}`, url: s.url })),
    ],
  };
}

/** Open events of any age, plus events closed in the last `closedDays` days. */
export async function loadEonet(closedDays = 14): Promise<NaturalEvent[]> {
  const [open, closed] = await Promise.all([
    fetchJson(`${API}?status=open`),
    fetchJson(`${API}?status=closed&days=${closedDays}`),
  ]);
  const byId = new Map<string, NaturalEvent>();
  for (const payload of [open, closed]) {
    const { events } = response.parse(payload);
    for (const raw of events) {
      const normalized = normalizeEonetEvent(raw);
      if (normalized) byId.set(normalized.id, normalized);
    }
  }
  return [...byId.values()];
}

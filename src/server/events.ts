import "server-only";
import { haversineKm } from "@/lib/geo";
import type { EventCategory, EventsPayload, NaturalEvent } from "@/lib/types";
import { eonet, healthOf, usgs, usgsOlder } from "./sources";

/**
 * EONET occasionally carries an earthquake that USGS also reports. USGS is the authority for
 * earthquakes, so an EONET quake within 50 km and 1 hour of a USGS quake is dropped.
 */
export function mergeEvents(eonetEvents: NaturalEvent[], usgsEvents: NaturalEvent[]) {
  const quakes = usgsEvents;
  const kept = eonetEvents.filter((e) => {
    if (e.category !== "earthquakes") return true;
    const t = Date.parse(e.observedAt);
    return !quakes.some(
      (q) =>
        Math.abs(Date.parse(q.observedAt) - t) < 3_600_000 &&
        haversineKm(e.lat, e.lon, q.lat, q.lon) < 50,
    );
  });
  return [...kept, ...usgsEvents].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export interface EventQuery {
  categories?: EventCategory[];
  /** Only events observed at or after this time. */
  since?: Date;
  until?: Date;
  status?: "open" | "closed";
  minMagnitude?: number;
  bbox?: [west: number, south: number, east: number, north: number];
  limit?: number;
}

function inBox(e: NaturalEvent, [w, s, east, n]: NonNullable<EventQuery["bbox"]>) {
  const inLon = w <= east ? e.lon >= w && e.lon <= east : e.lon >= w || e.lon <= east;
  return inLon && e.lat >= s && e.lat <= n;
}

export function filterEvents(events: NaturalEvent[], q: EventQuery) {
  let out = events;
  if (q.categories?.length) {
    const set = new Set(q.categories);
    out = out.filter((e) => set.has(e.category));
  }
  if (q.since) {
    const t = q.since.toISOString();
    out = out.filter((e) => e.observedAt >= t);
  }
  if (q.until) {
    const t = q.until.toISOString();
    out = out.filter((e) => e.startedAt <= t);
  }
  if (q.status) {
    out = out.filter((e) =>
      e.provider === "usgs" ? true : q.status === "open" ? e.status === "open" : e.status === "closed",
    );
  }
  if (q.minMagnitude !== undefined) {
    const min = q.minMagnitude;
    out = out.filter((e) => e.category !== "earthquakes" || (e.magnitude?.value ?? 0) >= min);
  }
  if (q.bbox) {
    const box = q.bbox;
    out = out.filter((e) => inBox(e, box));
  }
  return q.limit ? out.slice(0, q.limit) : out;
}

export async function getEvents(): Promise<EventsPayload> {
  const [a, b, older] = await Promise.all([eonet.get(), usgs.get(), usgsOlder.get()]);
  // The real-time weekly feed wins wherever the two USGS ranges overlap.
  const quakes = new Map((older.data ?? []).map((q) => [q.id, q]));
  for (const q of b.data ?? []) quakes.set(q.id, q);
  const events = mergeEvents(a.data ?? [], [...quakes.values()]);
  const retrieved = [a.lastSuccess, b.lastSuccess].filter((x): x is number => x !== null);
  return {
    events,
    retrievedAt: retrieved.length ? new Date(Math.max(...retrieved)).toISOString() : null,
    sources: (["eonet", "usgs"] as const).map((id) => {
      const h = healthOf(id);
      return { id, status: h.status, lastSuccess: h.lastSuccess, lastError: h.lastError };
    }),
  };
}

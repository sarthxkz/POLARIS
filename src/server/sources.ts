import "server-only";
import { createCollector, statusOf, type CollectorState } from "./collector";
import { loadEonet } from "./providers/eonet";
import { loadUsgsOlder, loadUsgsWeek } from "./providers/usgs";
import { loadOpenSky, openskyRefreshSeconds, openskyQuota, openskyAccess } from "./providers/opensky";
import { loadCelestrak } from "./providers/celestrak";
import { loadGibsTimes } from "./providers/gibs";
import type { NaturalEvent, ProviderId, SourceHealth } from "@/lib/types";

const MIN = 60_000;

export const eonet = createCollector({ id: "eonet", ttlMs: 10 * MIN, load: () => loadEonet() });
export const usgs = createCollector({ id: "usgs", ttlMs: 5 * MIN, load: loadUsgsWeek });
// Days 8–14 change rarely; fetched from the FDSN service a few times a day.
export const usgsOlder = createCollector({ id: "usgs-older", ttlMs: 6 * 60 * MIN, load: loadUsgsOlder });
export const opensky = createCollector({
  id: "opensky",
  ttlMs: openskyRefreshSeconds * 1000,
  maxBackoffMs: 60 * MIN,
  load: loadOpenSky,
});
// CelesTrak regenerates element sets about every two hours and asks clients not to poll faster.
export const celestrak = createCollector({ id: "celestrak", ttlMs: 2 * 60 * MIN, load: loadCelestrak });
export const gibs = createCollector({ id: "gibs", ttlMs: 10 * MIN, load: loadGibsTimes });

/** Request-driven providers (one call per visitor action) report their last outcome here. */
const directCalls = ((globalThis as { __polarisDirect?: Map<ProviderId, { ok: number | null; err: string | null; at: number | null }> })
  .__polarisDirect ??= new Map());

export function recordDirectCall(id: ProviderId, error: string | null) {
  const entry = directCalls.get(id) ?? { ok: null, err: null, at: null };
  entry.at = Date.now();
  if (error) entry.err = error;
  else {
    entry.ok = Date.now();
    entry.err = null;
  }
  directCalls.set(id, entry);
}

interface SourceMeta {
  id: ProviderId;
  name: string;
  supplies: string;
  homepage: string;
  terms: string;
  refreshSeconds: number;
  freshnessSeconds: number;
}

export const SOURCE_META: SourceMeta[] = [
  {
    id: "eonet",
    name: "NASA EONET",
    supplies: "Curated natural events: wildfires, storms, volcanoes, sea and lake ice, dust, floods.",
    homepage: "https://eonet.gsfc.nasa.gov/",
    terms: "NASA open data; no key required.",
    refreshSeconds: 600,
    freshnessSeconds: 3600,
  },
  {
    id: "usgs",
    name: "USGS Earthquake Hazards",
    supplies: "Magnitude 2.5+ earthquakes worldwide from the past 14 days.",
    homepage: "https://earthquake.usgs.gov/earthquakes/feed/",
    terms: "U.S. public domain; no key required.",
    refreshSeconds: 300,
    freshnessSeconds: 1200,
  },
  {
    id: "opensky",
    name: "OpenSky Network",
    supplies: "Aircraft positions from ADS-B and Mode S receivers run by volunteers.",
    homepage: "https://opensky-network.org/",
    terms:
      openskyAccess === "anonymous"
        ? "Non-commercial use; anonymous access limited to 400 credits a day."
        : "Non-commercial use; authenticated access.",
    refreshSeconds: openskyRefreshSeconds,
    freshnessSeconds: openskyRefreshSeconds * 2 + 120,
  },
  {
    id: "celestrak",
    name: "CelesTrak",
    supplies: "Orbital element sets (GP/OMM) used to estimate satellite positions with SGP4.",
    homepage: "https://celestrak.org/",
    terms: "Free public data; refreshed no more than every two hours, as CelesTrak asks.",
    refreshSeconds: 7200,
    freshnessSeconds: 12 * 3600,
  },
  {
    id: "gibs",
    name: "NASA GIBS",
    supplies: "Satellite imagery tiles: Blue Marble, city lights, daily true colour, cloud infrared, precipitation.",
    homepage: "https://earthdata.nasa.gov/gibs",
    terms: "NASA open data; no key required.",
    refreshSeconds: 600,
    freshnessSeconds: 3 * 3600,
  },
  {
    id: "openmeteo",
    name: "Open-Meteo",
    supplies: "Modelled current weather for a chosen point, and place-name search.",
    homepage: "https://open-meteo.com/",
    terms: "Free for non-commercial use with attribution; CC BY 4.0.",
    refreshSeconds: 0,
    freshnessSeconds: 3600,
  },
];

function iso(ms: number | null | undefined) {
  return ms ? new Date(ms).toISOString() : null;
}

function newestObservation(id: ProviderId): number | null {
  switch (id) {
    case "eonet":
    case "usgs": {
      const data = (id === "eonet" ? eonet : usgs).peek().data as NaturalEvent[] | null;
      if (!data?.length) return null;
      return Math.max(...data.map((e) => Date.parse(e.observedAt)));
    }
    case "opensky": {
      const t = opensky.peek().data?.time;
      return t ? t * 1000 : null;
    }
    default:
      return null;
  }
}

function countOf(id: ProviderId): number | null {
  switch (id) {
    case "eonet":
      return eonet.peek().data?.length ?? null;
    case "usgs":
      return usgs.peek().data?.length ?? null;
    case "opensky":
      return opensky.peek().data?.aircraft.length ?? null;
    case "celestrak":
      return celestrak.peek().data?.satellites.length ?? null;
    default:
      return null;
  }
}

const collectors: Partial<Record<ProviderId, { peek(): CollectorState<unknown> }>> = {
  eonet,
  usgs,
  opensky,
  celestrak,
  gibs,
};

export function healthOf(id: ProviderId): SourceHealth {
  const meta = SOURCE_META.find((m) => m.id === id)!;
  const collector = collectors[id];
  const base = { ...meta };

  if (!collector) {
    const direct = directCalls.get(id);
    const status: SourceHealth["status"] = !direct?.at
      ? "idle"
      : direct.err && (!direct.ok || direct.ok < direct.at)
        ? "down"
        : "live";
    return {
      ...base,
      status,
      lastSuccess: iso(direct?.ok),
      lastObservation: null,
      lastError: direct?.err ?? null,
      recordCount: null,
      nextAttempt: null,
    };
  }

  const state = collector.peek();
  // For curated feeds (EONET), event age is not feed age: judge freshness by retrieval time.
  const observed = newestObservation(id);
  const freshnessReference = id === "opensky" ? observed : null;
  let status = statusOf(state, freshnessReference, meta.freshnessSeconds * 1000);
  let lastError = state.lastError;
  // CelesTrak loads per group: a partial load is stale, and says which groups are old copies.
  const failed = id === "celestrak" ? (celestrak.peek().data?.failedGroups ?? []) : [];
  if (failed.length && status === "live") {
    status = "stale";
    lastError = `Could not refresh ${failed.join(", ")}; showing the last good copy of ${failed.length === 1 ? "that group" : "those groups"}`;
  }
  return {
    ...base,
    status,
    lastSuccess: iso(state.lastSuccess),
    lastObservation: iso(observed),
    lastError,
    recordCount: countOf(id),
    nextAttempt: state.lastError ? iso(state.nextAttempt) : null,
  };
}

export function allHealth(): SourceHealth[] {
  return SOURCE_META.map((m) => healthOf(m.id));
}

export function openskyQuotaRemaining() {
  return openskyQuota.remaining;
}

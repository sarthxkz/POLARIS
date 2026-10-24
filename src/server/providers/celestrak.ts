import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import { readCache, writeCache } from "../disk-cache";
import type { OrbitalElements, SatelliteGroup } from "@/lib/types";

/**
 * Curated CelesTrak groups. Kept deliberately small (a few hundred objects): each one is
 * propagated in the visitor's browser every second, and the full active catalogue (10,000+)
 * would cost far more than it would tell a curious visitor.
 */
export const SATELLITE_GROUPS: SatelliteGroup[] = [
  { id: "stations", label: "Space stations", description: "Crewed stations and the modules and vehicles docked to them." },
  { id: "visual", label: "Brightest", description: "The roughly 100 satellites most easily seen with the naked eye." },
  { id: "weather", label: "Weather", description: "Meteorological satellites in low and geostationary orbits." },
  { id: "gps-ops", label: "GPS", description: "Operational GPS navigation satellites in medium Earth orbit." },
  { id: "science", label: "Science", description: "Earth and space science missions." },
];

/** CelesTrak regenerates GP data about every two hours and refuses repeat downloads inside that window. */
const FRESH_MS = 2 * 60 * 60_000;

const omm = z.object({
  OBJECT_NAME: z.string(),
  OBJECT_ID: z.string(),
  EPOCH: z.string(),
  MEAN_MOTION: z.number(),
  ECCENTRICITY: z.number(),
  INCLINATION: z.number(),
  RA_OF_ASC_NODE: z.number(),
  ARG_OF_PERICENTER: z.number(),
  MEAN_ANOMALY: z.number(),
  EPHEMERIS_TYPE: z.number(),
  CLASSIFICATION_TYPE: z.string(),
  NORAD_CAT_ID: z.number(),
  ELEMENT_SET_NO: z.number(),
  REV_AT_EPOCH: z.number(),
  BSTAR: z.number(),
  MEAN_MOTION_DOT: z.number(),
  MEAN_MOTION_DDOT: z.number(),
});

export function parseOmm(raw: unknown): OrbitalElements | null {
  const parsed = omm.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const url = (group: string) =>
  `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;

export interface CelestrakResult {
  satellites: (OrbitalElements & { group: string })[];
  /** Groups whose newest download failed; their last good copy (if any) is served instead. */
  failedGroups: string[];
  /** Oldest fetch time among the groups served, so freshness is reported for the stalest part. */
  oldestFetch: number;
}

async function loadGroup(group: string): Promise<{ rows: unknown[]; fetchedAt: number; failed: boolean }> {
  const cached = await readCache<unknown[]>(`celestrak-${group}`);
  if (cached && Date.now() - cached.savedAt < FRESH_MS) {
    return { rows: cached.value, fetchedAt: cached.savedAt, failed: false };
  }
  try {
    const rows = z.array(z.unknown()).min(1).parse(await fetchJson(url(group), { retries: 1 }));
    await writeCache(`celestrak-${group}`, rows);
    return { rows, fetchedAt: Date.now(), failed: false };
  } catch (error) {
    if (cached) return { rows: cached.value, fetchedAt: cached.savedAt, failed: true };
    throw error;
  }
}

/** One request per group at most every two hours; an object in two groups keeps its first group. */
export async function loadCelestrak(): Promise<CelestrakResult> {
  const results = await Promise.allSettled(SATELLITE_GROUPS.map((g) => loadGroup(g.id)));
  if (results.every((r) => r.status === "rejected")) {
    throw (results[0] as PromiseRejectedResult).reason;
  }
  const seen = new Set<number>();
  const satellites: (OrbitalElements & { group: string })[] = [];
  const failedGroups: string[] = [];
  let oldestFetch = Date.now();
  results.forEach((r, i) => {
    const group = SATELLITE_GROUPS[i]!.id;
    if (r.status === "rejected") {
      failedGroups.push(group);
      return;
    }
    if (r.value.failed) failedGroups.push(group);
    oldestFetch = Math.min(oldestFetch, r.value.fetchedAt);
    for (const raw of r.value.rows) {
      const el = parseOmm(raw);
      if (!el || seen.has(el.NORAD_CAT_ID)) continue;
      seen.add(el.NORAD_CAT_ID);
      satellites.push({ ...el, group });
    }
  });
  return { satellites, failedGroups, oldestFetch };
}

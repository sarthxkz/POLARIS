import { eciToEcf, eciToGeodetic, gstime, json2satrec, propagate, type SatRec } from "./sgp4";
import type { OrbitalElements } from "./types";

/**
 * SGP4 estimates from published orbital elements. These are model positions, not telemetry:
 * error grows with distance from the element epoch (roughly a kilometre or so per day for
 * low orbits, more for objects that are manoeuvring or decaying).
 */
export interface SatelliteTrack {
  noradId: number;
  name: string;
  group: string;
  elements: OrbitalElements;
  satrec: SatRec;
  periodMinutes: number;
}

export interface EstimatedState {
  /** Earth-fixed position in metres (ECEF), ready for Cesium. */
  ecef: [number, number, number];
  lat: number;
  lon: number;
  altitudeKm: number;
  speedKms: number;
}

export function buildTrack(elements: OrbitalElements & { group: string }): SatelliteTrack | null {
  // SGP4 only applies to ephemeris type 0 element sets.
  if (Number(elements.EPHEMERIS_TYPE) !== 0) return null;
  try {
    const satrec = json2satrec({
      ...elements,
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: elements.CLASSIFICATION_TYPE === "C" ? "C" : "U",
    });
    if (satrec.error) return null;
    return {
      noradId: elements.NORAD_CAT_ID,
      name: elements.OBJECT_NAME,
      group: elements.group,
      elements,
      satrec,
      periodMinutes: 1440 / elements.MEAN_MOTION,
    };
  } catch {
    return null;
  }
}

export function estimate(track: SatelliteTrack, date: Date): EstimatedState | null {
  const pv = propagate(track.satrec, date);
  if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
  const gmst = gstime(date);
  const ecf = eciToEcf(pv.position, gmst);
  const geo = eciToGeodetic(pv.position, gmst);
  const v = pv.velocity;
  const speed = v && typeof v !== "boolean" ? Math.hypot(v.x, v.y, v.z) : NaN;
  const lat = (geo.latitude * 180) / Math.PI;
  const lon = (geo.longitude * 180) / Math.PI;
  if (!Number.isFinite(lat) || !Number.isFinite(geo.height)) return null;
  return {
    ecef: [ecf.x * 1000, ecf.y * 1000, ecf.z * 1000],
    lat,
    lon,
    altitudeKm: geo.height,
    speedKms: speed,
  };
}

/** Earth-fixed path over one orbital period starting at `from`, for drawing the orbit. */
export function orbitPath(track: SatelliteTrack, from: Date, steps = 180): [number, number, number][] {
  const points: [number, number, number][] = [];
  const stepMs = (track.periodMinutes * 60_000) / steps;
  for (let i = 0; i <= steps; i++) {
    const s = estimate(track, new Date(from.getTime() + i * stepMs));
    if (s) points.push(s.ecef);
  }
  return points;
}

export function elementAgeHours(elements: OrbitalElements, now = Date.now()) {
  // CelesTrak epochs are UTC without a zone designator.
  const epoch = Date.parse(elements.EPOCH.endsWith("Z") ? elements.EPOCH : `${elements.EPOCH}Z`);
  return (now - epoch) / 3_600_000;
}

export function orbitClass(altitudeKm: number) {
  if (altitudeKm < 2_000) return "Low Earth orbit";
  if (altitudeKm < 35_000) return "Medium Earth orbit";
  if (altitudeKm < 36_500) return "Geostationary";
  return "High Earth orbit";
}

// Small geographic helpers shared by server and browser.

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isValidLatLon(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Parses coordinates typed into search: "18.52, 73.85", "18.52 73.85", "18.52N 73.85E",
 * "18°31'N 73°51'E", "-33.86, 151.21". Returns null when the text is not coordinates.
 */
export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const text = input.trim().toUpperCase().replace(/[,;]/g, " ");
  const part = String.raw`([+-]?\d+(?:\.\d+)?)(?:\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(?:(\d+(?:\.\d+)?)\s*["″])?)?\s*([NSEW])?`;
  const match = new RegExp(`^${part}\\s+${part}$`).exec(text);
  if (!match) return null;

  const read = (deg?: string, min?: string, sec?: string, hemi?: string) => {
    let value = Math.abs(Number(deg)) + Number(min ?? 0) / 60 + Number(sec ?? 0) / 3600;
    if (deg?.startsWith("-") || hemi === "S" || hemi === "W") value = -value;
    return value;
  };

  const a = read(match[1], match[2], match[3], match[4]);
  const b = read(match[5], match[6], match[7], match[8]);
  // Respect explicit hemispheres when the order is lon-first ("73.85E 18.52N").
  const aIsLon = match[4] === "E" || match[4] === "W";
  const lat = aIsLon ? b : a;
  const lon = aIsLon ? a : b;
  return isValidLatLon(lat, lon) ? { lat, lon } : null;
}

export function formatLatLon(lat: number, lon: number, digits = 2) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lon).toFixed(digits)}° ${ew}`;
}

export interface Country {
  name: string;
  iso: string;
  lon: number;
  lat: number;
  rank: number;
  bbox: [number, number, number, number];
  /** Polygons → rings → flat [lon, lat, ...]. First ring of each polygon is the outer ring. */
  polygons: number[][][];
}

function inRing(lon: number, lat: number, ring: number[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i]!;
    const yi = ring[i + 1]!;
    const xj = ring[j]!;
    const yj = ring[j + 1]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The Natural Earth (1:110m) country containing a point, or null over open water. */
export function countryAt(lon: number, lat: number, countries: Country[]): Country | null {
  for (const c of countries) {
    const [w, s, e, n] = c.bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    for (const [outer, ...holes] of c.polygons) {
      if (outer && inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h))) return c;
    }
  }
  return null;
}

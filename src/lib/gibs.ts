/**
 * NASA GIBS true-colour snapshots: a real satellite picture (VIIRS on Suomi NPP) of an area on
 * a given UTC day. Daily swaths fill in as the satellite passes, so "today" is often incomplete;
 * we use the day of observation if it is before today, otherwise the previous day, and say so.
 */
const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

export function snapshotDay(observedAt: string, now = Date.now()): { day: string; previousDay: boolean } {
  const observed = observedAt.slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  if (observed < today) return { day: observed, previousDay: false };
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  return { day: yesterday, previousDay: true };
}

/** Square-ish box `spanDeg` tall around a point, widened for latitude so the picture is not squashed. */
export function snapshotUrl(lat: number, lon: number, day: string, spanDeg = 3, size = 640) {
  const half = spanDeg / 2;
  const lonHalf = Math.min(60, half / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const south = Math.max(-90, lat - half);
  const north = Math.min(90, lat + half);
  const west = Math.max(-180, lon - lonHalf);
  const east = Math.min(180, lon + lonHalf);
  const width = Math.round(size * Math.min(2, (east - west) / (north - south) / (1 / Math.cos((lat * Math.PI) / 180))));
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    STYLES: "",
    CRS: "EPSG:4326",
    // WMS 1.3.0 with EPSG:4326 takes latitude first.
    BBOX: [south, west, north, east].map((v) => v.toFixed(4)).join(","),
    WIDTH: String(Math.max(200, width)),
    HEIGHT: String(size),
    FORMAT: "image/jpeg",
    TIME: day,
  });
  return `${WMS}?${params}`;
}

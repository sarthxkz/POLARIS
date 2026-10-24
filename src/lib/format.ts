// Formatting for times, ages and measurements. All times are shown in UTC and say so.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

export function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "23 Oct 2026, 19:20 UTC" */
export function formatUtc(value: string | number | Date, withSeconds = false) {
  const d = toDate(value);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${withSeconds ? `:${pad(d.getUTCSeconds())}` : ""}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${time} UTC`;
}

/** "23 Oct, 19:20" — compact, for lists that already say UTC in their header. */
export function formatUtcShort(value: string | number | Date) {
  const d = toDate(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatUtcDay(value: string | number | Date) {
  const d = toDate(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatClock(d: Date) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function formatAge(value: string | number | Date | null | undefined, now = Date.now()) {
  if (value === null || value === undefined) return "—";
  const seconds = Math.max(0, (now - toDate(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 36) return `${Math.round(hours)} h ago`;
  const days = hours / 24;
  return `${Math.round(days)} days ago`;
}

/** Compact age without "ago", for tight columns: "4m", "3h", "2d". */
export function formatAgeShort(value: string | number | Date | null | undefined, now = Date.now()) {
  if (value === null || value === undefined) return "—";
  const seconds = Math.max(0, (now - toDate(value).getTime()) / 1000);
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400 * 1.5) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

const grouped = new Intl.NumberFormat("en-GB");
export function formatCount(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : grouped.format(n);
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Altitude in metres and feet: "11,582 m · 38,000 ft". */
export function formatAltitude(metres: number | null | undefined) {
  if (metres === null || metres === undefined) return "—";
  const feet = Math.round((metres * 3.28084) / 100) * 100;
  return `${formatNumber(metres)} m · ${formatNumber(feet)} ft`;
}

/** Ground speed from m/s: "834 km/h · 450 kn". */
export function formatSpeed(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  return `${formatNumber(ms * 3.6)} km/h · ${formatNumber(ms * 1.943844)} kn`;
}

/** Provider units as people read them: "hectare" → "hectares", "kts" → "kt". */
export function unitLabel(unit: string) {
  const u = unit.trim().toLowerCase();
  if (u === "hectare" || u === "hectares" || u === "ha") return "hectares";
  if (u === "acre" || u === "acres") return "acres";
  if (u === "kts" || u === "kt" || u === "knots") return "kt";
  return unit;
}

/** Area in hectares when the provider gave an area, else null. */
export function areaHectares(magnitude: { value: number; unit: string } | null | undefined) {
  if (!magnitude) return null;
  const u = unitLabel(magnitude.unit);
  if (u === "hectares") return magnitude.value;
  if (u === "acres") return magnitude.value * 0.404686;
  return null;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export function formatHeading(deg: number | null | undefined) {
  if (deg === null || deg === undefined) return "—";
  const d = ((deg % 360) + 360) % 360;
  return `${Math.round(d)}° ${COMPASS[Math.round(d / 22.5) % 16]}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 120) return `${formatNumber(minutes, 1)} min`;
  const h = minutes / 60;
  if (h < 48) return `${formatNumber(h, 1)} h`;
  return `${formatNumber(h / 24, 2)} days`;
}

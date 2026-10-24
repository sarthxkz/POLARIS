import type { EventCategory } from "./types";

/**
 * Data colours. Four families only, so the globe never turns into a rainbow:
 * heat (amber), water and ice (frost), ground shaking (coral → red when critical),
 * everything else (sand). Category is told apart by its glyph, not by a new hue.
 */
export const DATA = {
  heat: "#f2b24c",
  water: "#dce8f5",
  quake: "#ff8b78",
  critical: "#ff5d5d",
  other: "#cdb68c",
  aircraft: "#c9d6e6",
  satellite: "#8fc3f5",
  selected: "#52d3f2",
} as const;

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  wildfires: DATA.heat,
  volcanoes: DATA.heat,
  tempExtremes: DATA.heat,
  severeStorms: DATA.water,
  floods: DATA.water,
  seaLakeIce: DATA.water,
  snow: DATA.water,
  waterColor: DATA.water,
  earthquakes: DATA.quake,
  landslides: DATA.other,
  dustHaze: DATA.other,
  drought: DATA.other,
  manmade: DATA.other,
};

/** USGS-style threshold: magnitude 6 and above is shown in the critical colour. */
export const CRITICAL_MAGNITUDE = 6;

export function quakeColor(magnitude: number | null | undefined) {
  return (magnitude ?? 0) >= CRITICAL_MAGNITUDE ? DATA.critical : DATA.quake;
}

/** Marker diameter in px for an earthquake, growing with magnitude (energy is logarithmic). */
export function quakeSize(magnitude: number | null | undefined) {
  const m = Math.max(2.5, Math.min(9, magnitude ?? 2.5));
  return Math.round(7 + (m - 2.5) * 4.2);
}

import { EVENT_CATEGORIES } from "@/lib/categories";
import type { EventCategory } from "@/lib/types";
import type { ImageryKey } from "@/components/globe/engine";

export const WINDOWS = [
  { days: 1, label: "24 h" },
  { days: 3, label: "3 days" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
] as const;
export type WindowDays = (typeof WINDOWS)[number]["days"];

export interface LayerState {
  categories: Record<EventCategory, boolean>;
  aircraft: boolean;
  /** Altitude band in metres; aircraft on the ground are hidden unless `ground` is on. */
  altitude: [number, number];
  ground: boolean;
  satelliteGroups: Record<string, boolean>;
  imagery: Record<ImageryKey, boolean>;
}

export const MAX_ALTITUDE_M = 13_000;

export const DEFAULT_LAYERS: LayerState = {
  categories: Object.fromEntries(EVENT_CATEGORIES.map((c) => [c, true])) as Record<EventCategory, boolean>,
  aircraft: true,
  altitude: [0, MAX_ALTITUDE_M],
  ground: false,
  satelliteGroups: { stations: true, visual: true, weather: false, "gps-ops": false, science: false },
  imagery: {
    nightLights: true,
    borders: true,
    labels: true,
    trueColor: false,
    clouds: false,
    precipitation: false,
  },
};

/** Groups of event categories as the layer rail presents them. */
export const CATEGORY_GROUPS: { label: string; categories: EventCategory[] }[] = [
  { label: "Fire and heat", categories: ["wildfires", "volcanoes", "tempExtremes"] },
  { label: "Water, ice and storms", categories: ["severeStorms", "floods", "seaLakeIce", "snow", "waterColor"] },
  { label: "Ground", categories: ["earthquakes", "landslides"] },
  { label: "Air and land", categories: ["dustHaze", "drought", "manmade"] },
];

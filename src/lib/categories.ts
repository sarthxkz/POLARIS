import type { EventCategory } from "./types";

export const EVENT_CATEGORIES = [
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
] as const satisfies readonly EventCategory[];

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  wildfires: "Wildfires",
  severeStorms: "Severe storms",
  volcanoes: "Volcanoes",
  earthquakes: "Earthquakes",
  seaLakeIce: "Sea and lake ice",
  floods: "Floods",
  landslides: "Landslides",
  dustHaze: "Dust and haze",
  drought: "Drought",
  snow: "Snow",
  tempExtremes: "Temperature extremes",
  waterColor: "Water colour",
  manmade: "Human-made",
};

/** Singular noun for one event of the category, used in sentences. */
export const CATEGORY_NOUN: Record<EventCategory, string> = {
  wildfires: "wildfire",
  severeStorms: "storm",
  volcanoes: "volcanic activity",
  earthquakes: "earthquake",
  seaLakeIce: "ice event",
  floods: "flood",
  landslides: "landslide",
  dustHaze: "dust or haze event",
  drought: "drought",
  snow: "snow event",
  tempExtremes: "temperature extreme",
  waterColor: "water colour event",
  manmade: "human-made event",
};

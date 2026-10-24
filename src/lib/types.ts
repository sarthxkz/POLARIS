// Domain types shared by the server routes and the browser. Every record keeps the
// provider it came from and the time it was observed, so the UI never has to guess.

export type ProviderId =
  | "eonet"
  | "usgs"
  | "opensky"
  | "celestrak"
  | "openmeteo"
  | "gibs";

export type SourceStatus =
  /** Last retrieval succeeded and the newest observation is within its freshness threshold. */
  | "live"
  /** Last retrieval succeeded but the data is older than the freshness threshold. */
  | "stale"
  /** The provider refused us for quota reasons; we are waiting out its window. */
  | "limited"
  /** Last retrieval failed and we hold no usable data. */
  | "down"
  /** Not requested yet in this server process (collectors run on demand). */
  | "idle";

export interface SourceHealth {
  id: ProviderId;
  name: string;
  /** What the provider supplies, in plain words. */
  supplies: string;
  homepage: string;
  terms: string;
  status: SourceStatus;
  /** ISO time of the last successful retrieval. */
  lastSuccess: string | null;
  /** ISO time of the newest observation inside the last good payload. */
  lastObservation: string | null;
  lastError: string | null;
  /** How often we refresh, in seconds. */
  refreshSeconds: number;
  /** Older than this (seconds) and the data is reported stale. */
  freshnessSeconds: number;
  recordCount: number | null;
  /** When the next retrieval is allowed (backoff or quota window). */
  nextAttempt: string | null;
}

export type EventCategory =
  | "wildfires"
  | "severeStorms"
  | "volcanoes"
  | "earthquakes"
  | "seaLakeIce"
  | "floods"
  | "landslides"
  | "dustHaze"
  | "drought"
  | "snow"
  | "tempExtremes"
  | "waterColor"
  | "manmade";

export interface EventPoint {
  lon: number;
  lat: number;
  /** ISO observation time of this sample. */
  time: string;
  magnitude: number | null;
}

export interface NaturalEvent {
  /** Stable id: `${provider}:${providerEventId}`. */
  id: string;
  provider: Extract<ProviderId, "eonet" | "usgs">;
  providerEventId: string;
  title: string;
  category: EventCategory;
  /** Latest known position. For polygon geometries this is the centroid and `approximate` is true. */
  lon: number;
  lat: number;
  approximate: boolean;
  /** Ordered oldest → newest. Storm tracks have many; most events have one. */
  track: EventPoint[];
  startedAt: string;
  /** Time of the newest observation the provider reports. */
  observedAt: string;
  /** Provider's own update time when it gives one (USGS), else null. */
  providerUpdatedAt: string | null;
  /** "open"/"closed" from EONET; USGS review status ("automatic"/"reviewed"). */
  status: string | null;
  magnitude: { value: number; unit: string } | null;
  description: string | null;
  /** Human-facing pages. The first is the canonical event page. */
  links: { label: string; url: string }[];
  /** USGS only: tsunami flag and PAGER alert level, exactly as supplied. */
  tsunami?: boolean;
  alert?: string | null;
  depthKm?: number | null;
}

export interface EventsPayload {
  events: NaturalEvent[];
  retrievedAt: string | null;
  sources: Pick<SourceHealth, "id" | "status" | "lastSuccess" | "lastError">[];
}

/** Compact aircraft row; positional to keep a ~10k-row snapshot small on the wire. */
export type AircraftRow = [
  icao24: string,
  callsign: string | null,
  originCountry: string,
  lon: number,
  lat: number,
  baroAltitudeM: number | null,
  geoAltitudeM: number | null,
  onGround: boolean,
  velocityMs: number | null,
  trackDeg: number | null,
  verticalRateMs: number | null,
  /** Unix seconds of the last position update. */
  timePosition: number | null,
  /** Unix seconds of the last message of any kind. */
  lastContact: number,
];

export interface AircraftPayload {
  /** OpenSky's own snapshot time (unix seconds). */
  snapshotTime: number | null;
  retrievedAt: string | null;
  aircraft: AircraftRow[];
  /** Anonymous or authenticated access, which drives the refresh interval. */
  access: "anonymous" | "authenticated";
  refreshSeconds: number;
  health: Pick<SourceHealth, "status" | "lastError" | "nextAttempt">;
  /** True only for the labelled local-development adapter. Never set in production. */
  simulated: boolean;
}

/** CelesTrak OMM record, the subset SGP4 needs plus identity. */
export interface OrbitalElements {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export interface SatelliteGroup {
  id: string;
  label: string;
  description: string;
}

export interface SatellitesPayload {
  groups: (SatelliteGroup & { count: number })[];
  satellites: (OrbitalElements & { group: string })[];
  retrievedAt: string | null;
  health: Pick<SourceHealth, "status" | "lastError">;
}

export interface PlaceResult {
  id: string;
  name: string;
  /** "Maharashtra, India" etc. */
  context: string;
  kind: "place" | "country" | "coordinates";
  lon: number;
  lat: number;
  /** Rough camera height in metres suited to the place's size. */
  viewHeight: number;
}

export interface WeatherNow {
  lat: number;
  lon: number;
  /** Model time the values are valid for (ISO, UTC). */
  validAt: string;
  temperatureC: number | null;
  apparentC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  windDirDeg: number | null;
  gustKmh: number | null;
  precipitationMm: number | null;
  cloudCoverPct: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
  retrievedAt: string;
}

export interface ImageryTimes {
  /** Latest available time per GIBS layer id, as GIBS publishes it. */
  layers: Record<string, string | null>;
  retrievedAt: string | null;
}

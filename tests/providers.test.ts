import { describe, expect, it } from "vitest";
import { normalizeEonetEvent } from "@/server/providers/eonet";
import { normalizeUsgsFeature } from "@/server/providers/usgs";
import { normalizeStateVector } from "@/server/providers/opensky";
import { filterEvents, mergeEvents } from "@/server/events";

const storm = {
  id: "EONET_1",
  title: "Hurricane Test ",
  description: null,
  link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1",
  closed: null,
  categories: [{ id: "severeStorms", title: "Severe Storms" }],
  sources: [{ id: "JTWC", url: "https://example.org/jtwc" }],
  geometry: [
    { magnitudeValue: 45, magnitudeUnit: "kts", date: "2026-10-22T18:00:00Z", type: "Point", coordinates: [-100, 10] },
    { magnitudeValue: 35, magnitudeUnit: "kts", date: "2026-10-21T18:00:00Z", type: "Point", coordinates: [-99, 9] },
  ],
};

describe("EONET normalisation", () => {
  it("orders the track oldest to newest and places the event at the newest sample", () => {
    const e = normalizeEonetEvent(storm)!;
    expect(e.id).toBe("eonet:EONET_1");
    expect(e.title).toBe("Hurricane Test");
    expect(e.track.map((p) => p.time)).toEqual(["2026-10-21T18:00:00.000Z", "2026-10-22T18:00:00.000Z"]);
    expect([e.lon, e.lat]).toEqual([-100, 10]);
    expect(e.magnitude).toEqual({ value: 45, unit: "kts" });
    expect(e.status).toBe("open");
    expect(e.approximate).toBe(false);
  });

  it("uses the centroid of a polygon and marks it approximate", () => {
    const e = normalizeEonetEvent({
      ...storm,
      categories: [{ id: "seaLakeIce", title: "Sea and Lake Ice" }],
      geometry: [
        {
          date: "2026-10-20T00:00:00Z",
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 2],
            ],
          ],
        },
      ],
    })!;
    expect(e.approximate).toBe(true);
    expect([e.lon, e.lat]).toEqual([1, 1]);
    expect(e.magnitude).toBeNull();
  });

  it("rejects unknown categories and malformed records instead of guessing", () => {
    expect(normalizeEonetEvent({ ...storm, categories: [{ id: "alienInvasion", title: "?" }] })).toBeNull();
    expect(normalizeEonetEvent({ ...storm, geometry: [] })).toBeNull();
    expect(normalizeEonetEvent({ nonsense: true })).toBeNull();
  });
});

describe("USGS normalisation", () => {
  const feature = {
    id: "us7000abcd",
    properties: {
      mag: 6.4,
      magType: "mww",
      place: "10 km N of Somewhere",
      time: Date.parse("2026-10-22T14:33:00Z"),
      updated: Date.parse("2026-10-22T15:00:00Z"),
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
      status: "reviewed",
      tsunami: 1,
      alert: "yellow",
      title: "M 6.4 - 10 km N of Somewhere",
    },
    geometry: { type: "Point", coordinates: [140.1, 35.2, 12.5] },
  };

  it("keeps magnitude, depth, status and flags exactly as published", () => {
    const e = normalizeUsgsFeature(feature)!;
    expect(e.magnitude).toEqual({ value: 6.4, unit: "Mmww" });
    expect(e.depthKm).toBe(12.5);
    expect(e.status).toBe("reviewed");
    expect(e.tsunami).toBe(true);
    expect(e.alert).toBe("yellow");
  });

  it("allows a missing magnitude without inventing one", () => {
    const e = normalizeUsgsFeature({ ...feature, properties: { ...feature.properties, mag: null } })!;
    expect(e.magnitude).toBeNull();
  });
});

describe("OpenSky state vectors", () => {
  const row = [
    "abc123", "TEST12  ", "France", 1792785448, 1792785449, 7.75731234, 45.43621234, 11582.44, false, 214.651,
    315.971, 0.04, null, 11650.98, "1000", false, 0,
  ];

  it("trims callsigns and precision", () => {
    const r = normalizeStateVector(row)!;
    expect(r[1]).toBe("TEST12");
    expect(r[3]).toBe(7.7573);
    expect(r[4]).toBe(45.4362);
    expect(r[5]).toBe(11582);
    expect(r[6]).toBe(11651);
    expect(r[8]).toBe(214.7);
  });

  it("drops aircraft without a position", () => {
    const noPos = [...row];
    noPos[5] = null;
    expect(normalizeStateVector(noPos)).toBeNull();
  });

  it("keeps an empty callsign as null, not an empty string", () => {
    const r = normalizeStateVector(["abc123", "        ", ...row.slice(2)])!;
    expect(r[1]).toBeNull();
  });
});

describe("event merging", () => {
  const usgsQuake = normalizeUsgsFeature({
    id: "us1",
    properties: { mag: 5, place: "x", time: Date.parse("2026-10-22T10:00:00Z"), updated: null, url: "https://u", status: "automatic" },
    geometry: { type: "Point", coordinates: [10, 10, 5] },
  })!;
  const eonetQuake = normalizeEonetEvent({
    ...storm,
    id: "EONET_Q",
    categories: [{ id: "earthquakes", title: "Earthquakes" }],
    geometry: [{ date: "2026-10-22T10:20:00Z", type: "Point", coordinates: [10.1, 10.1] }],
  })!;
  const eonetStorm = normalizeEonetEvent(storm)!;

  it("drops an EONET quake that USGS already reports nearby", () => {
    const merged = mergeEvents([eonetQuake, eonetStorm], [usgsQuake]);
    expect(merged.map((e) => e.id).sort()).toEqual(["eonet:EONET_1", "usgs:us1"]);
  });

  it("filters by category, time and a bounding box that crosses the antimeridian", () => {
    const merged = mergeEvents([eonetStorm], [usgsQuake]);
    expect(filterEvents(merged, { categories: ["earthquakes"] })).toHaveLength(1);
    expect(filterEvents(merged, { since: new Date("2026-10-22T12:00:00Z") }).map((e) => e.id)).toEqual(["eonet:EONET_1"]);
    expect(filterEvents(merged, { bbox: [170, -20, -90, 20] }).map((e) => e.id)).toEqual(["eonet:EONET_1"]);
  });
});

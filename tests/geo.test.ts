import { describe, expect, it } from "vitest";
import { countryAt, formatLatLon, haversineKm, parseCoordinates, type Country } from "@/lib/geo";

describe("parseCoordinates", () => {
  it.each([
    ["18.52, 73.85", 18.52, 73.85],
    ["18.52 73.85", 18.52, 73.85],
    ["-33.86, 151.21", -33.86, 151.21],
    ["18.52N 73.85E", 18.52, 73.85],
    ["33.86S 151.21E", -33.86, 151.21],
    ["73.85E 18.52N", 18.52, 73.85],
    ["18°31'N 73°51'E", 18 + 31 / 60, 73 + 51 / 60],
  ])("parses %s", (input, lat, lon) => {
    const r = parseCoordinates(input);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(lat, 6);
    expect(r!.lon).toBeCloseTo(lon, 6);
  });

  it.each(["Pune", "95, 10", "10, 200", "", "1 2 3"])("rejects %s", (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});

describe("haversineKm", () => {
  it("measures London to Paris at about 344 km", () => {
    expect(haversineKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(343.5, 0);
  });
});

describe("formatLatLon", () => {
  it("uses hemispheres, never negative numbers", () => {
    expect(formatLatLon(-33.86, 151.21)).toBe("33.86° S, 151.21° E");
  });
});

describe("countryAt", () => {
  const square: Country = {
    name: "Square",
    iso: "SQR",
    lon: 0,
    lat: 0,
    rank: 1,
    bbox: [-10, -10, 10, 10],
    // Outer ring with a hole in the middle.
    polygons: [
      [
        [-10, -10, 10, -10, 10, 10, -10, 10, -10, -10],
        [-2, -2, 2, -2, 2, 2, -2, 2, -2, -2],
      ],
    ],
  };
  it("finds a point inside the outer ring", () => expect(countryAt(5, 5, [square])?.name).toBe("Square"));
  it("excludes points inside a hole", () => expect(countryAt(0, 0, [square])).toBeNull());
  it("returns null outside", () => expect(countryAt(20, 0, [square])).toBeNull());
});

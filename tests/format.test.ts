import { describe, expect, it } from "vitest";
import { areaHectares, formatAge, formatAltitude, formatUtc, unitLabel } from "@/lib/format";

describe("units", () => {
  it("reads EONET's singular 'hectare' as hectares", () => {
    expect(unitLabel("hectare")).toBe("hectares");
    expect(areaHectares({ value: 26_776, unit: "hectare" })).toBe(26_776);
  });

  it("compares acres and hectares on one scale", () => {
    const acres = areaHectares({ value: 2_604, unit: "acres" })!;
    const hectares = areaHectares({ value: 12_390, unit: "hectare" })!;
    expect(acres).toBeCloseTo(1_053.8, 1);
    expect(hectares).toBeGreaterThan(acres);
  });

  it("does not treat wind speed as an area", () => {
    expect(areaHectares({ value: 35, unit: "kts" })).toBeNull();
    expect(unitLabel("kts")).toBe("kt");
  });
});

describe("times and measures", () => {
  it("always says UTC", () => {
    expect(formatUtc("2026-10-23T19:10:45Z")).toBe("23 Oct 2026, 19:10 UTC");
  });

  it("ages relative to a given now", () => {
    const now = Date.parse("2026-10-23T20:00:00Z");
    expect(formatAge("2026-10-23T19:56:00Z", now)).toBe("4 min ago");
    expect(formatAge(null, now)).toBe("—");
  });

  it("prints a missing altitude as a dash, never zero", () => {
    expect(formatAltitude(null)).toBe("—");
    expect(formatAltitude(0)).toBe("0 m · 0 ft");
  });
});

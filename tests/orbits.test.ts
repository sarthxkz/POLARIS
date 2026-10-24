import { describe, expect, it } from "vitest";
import { buildTrack, elementAgeHours, estimate, orbitClass } from "@/lib/orbits";

// ISS element set as published by CelesTrak on 2026-10-22 (OMM JSON).
const iss = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-10-22T23:36:04.393152",
  MEAN_MOTION: 15.49006294,
  ECCENTRICITY: 0.00068639,
  INCLINATION: 51.6334,
  RA_OF_ASC_NODE: 27.6879,
  ARG_OF_PERICENTER: 297.6388,
  MEAN_ANOMALY: 62.3903,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 59156,
  BSTAR: 0.00018355787,
  MEAN_MOTION_DOT: 9.682e-5,
  MEAN_MOTION_DDOT: 0,
  group: "stations",
};

describe("SGP4 estimates", () => {
  const track = buildTrack(iss)!;

  it("builds a track with the right period", () => {
    expect(track.periodMinutes).toBeCloseTo(92.96, 1);
  });

  it("puts the ISS in low Earth orbit at a plausible altitude and speed", () => {
    const s = estimate(track, new Date("2026-10-23T12:00:00Z"))!;
    expect(s.altitudeKm).toBeGreaterThan(380);
    expect(s.altitudeKm).toBeLessThan(450);
    expect(s.speedKms).toBeGreaterThan(7.5);
    expect(s.speedKms).toBeLessThan(7.8);
    expect(Math.abs(s.lat)).toBeLessThanOrEqual(51.7);
    expect(orbitClass(s.altitudeKm)).toBe("Low Earth orbit");
  });

  it("measures element age from the UTC epoch", () => {
    expect(elementAgeHours(iss, Date.parse("2026-10-23T23:36:04Z"))).toBeCloseTo(24, 1);
  });

  it("refuses element sets SGP4 cannot use", () => {
    expect(buildTrack({ ...iss, EPHEMERIS_TYPE: 2 })).toBeNull();
  });
});

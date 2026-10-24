import "server-only";
import { z } from "zod";
import { fetchJson, ProviderError } from "../http";
import type { AircraftRow } from "@/lib/types";

const STATES = "https://opensky-network.org/api/states/all";
const TOKEN =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

export const openskyAccess: "anonymous" | "authenticated" =
  process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET
    ? "authenticated"
    : "anonymous";

/**
 * Anonymous access allows 400 credits a day and a global query costs 4, so one snapshot every
 * 15 minutes (96 a day) stays inside the budget with room for restarts. Authenticated accounts
 * start at 4,000 credits a day.
 */
export const openskyRefreshSeconds = (() => {
  const configured = Number(process.env.OPENSKY_REFRESH_SECONDS);
  const floor = openskyAccess === "authenticated" ? 90 : 900;
  if (Number.isFinite(configured) && configured > 0) return Math.max(floor, configured);
  return openskyAccess === "authenticated" ? 120 : 900;
})();

export const openskyQuota = { remaining: null as number | null };

let token: { value: string; expires: number } | null = null;

async function bearer(): Promise<Record<string, string>> {
  if (openskyAccess === "anonymous") return {};
  if (token && token.expires > Date.now() + 60_000) return { Authorization: `Bearer ${token.value}` };
  const response = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.OPENSKY_CLIENT_ID!,
      client_secret: process.env.OPENSKY_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new ProviderError(`OpenSky sign-in refused (HTTP ${response.status})`, response.status);
  const body = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await response.json());
  token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return { Authorization: `Bearer ${token.value}` };
}

const n = z.number().nullable();
const stateVector = z
  .tuple([
    z.string(), // 0 icao24
    z.string().nullable(), // 1 callsign
    z.string(), // 2 origin_country
    n, // 3 time_position
    z.number(), // 4 last_contact
    n, // 5 longitude
    n, // 6 latitude
    n, // 7 baro_altitude
    z.boolean(), // 8 on_ground
    n, // 9 velocity
    n, // 10 true_track
    n, // 11 vertical_rate
  ])
  .rest(z.unknown()); // sensors, geo_altitude, squawk, spi, position_source…

const payload = z.object({ time: z.number(), states: z.array(z.unknown()).nullable() });

export function normalizeStateVector(raw: unknown): AircraftRow | null {
  const parsed = stateVector.safeParse(raw);
  if (!parsed.success) return null;
  const s = parsed.data;
  const lon = s[5];
  const lat = s[6];
  if (lon === null || lat === null) return null;
  const geoAltitude = typeof s[13] === "number" ? (s[13] as number) : null;
  const callsign = s[1]?.trim() || null;
  // Trim to the precision the sensors support (~11 m, 1 m, 0.1 m/s, 0.1°) to keep the snapshot small.
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  const r0 = (v: number | null) => (v === null ? null : Math.round(v));
  return [s[0], callsign, s[2], r4(lon), r4(lat), r0(s[7]), r0(geoAltitude), s[8], r1(s[9]), r1(s[10]), r1(s[11]), s[3], s[4]];
}

export interface OpenSkySnapshot {
  time: number;
  aircraft: AircraftRow[];
}

export async function loadOpenSky(): Promise<OpenSkySnapshot> {
  const body = payload.parse(
    await fetchJson(STATES, {
      headers: await bearer(),
      timeoutMs: 30_000,
      retries: 1,
      onHeaders: (h) => {
        const remaining = Number(h.get("x-rate-limit-remaining"));
        if (Number.isFinite(remaining)) openskyQuota.remaining = remaining;
      },
    }),
  );
  const aircraft = (body.states ?? [])
    .map(normalizeStateVector)
    .filter((row): row is AircraftRow => row !== null);
  recordSamples(body.time, aircraft);
  return { time: body.time, aircraft };
}

/*
 * Short positional history, kept only in memory and only for snapshots this server actually
 * retrieved. It lets a selected aircraft show where it was seen on previous snapshots; it is
 * never written to disk and is gone on restart. Bounded to the last MAX_SAMPLES snapshots.
 */
const MAX_SAMPLES = 8;
type Sample = { time: number; positions: Map<string, [lon: number, lat: number, altM: number | null]> };
const samples: Sample[] = ((globalThis as { __polarisAircraftSamples?: Sample[] })
  .__polarisAircraftSamples ??= []);

function recordSamples(time: number, rows: AircraftRow[]) {
  if (samples.at(-1)?.time === time) return;
  const positions = new Map<string, [number, number, number | null]>();
  for (const r of rows) if (!r[7]) positions.set(r[0], [r[3], r[4], r[6] ?? r[5]]);
  samples.push({ time, positions });
  while (samples.length > MAX_SAMPLES) samples.shift();
}

export function storedTrack(icao24: string) {
  return samples.flatMap((s) => {
    const p = s.positions.get(icao24);
    return p ? [{ time: s.time, lon: p[0], lat: p[1], altitudeM: p[2] }] : [];
  });
}

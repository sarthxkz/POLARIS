# POLARIS — World Intelligence System

*Navigate the Bigger Picture.*

A public website that puts live Earth-observation data on a 3D globe: natural events, earthquakes,
aircraft, satellites and weather, each with its source and the time it was observed.

- **Globe** (`/`) — CesiumJS globe on Sentinel-2 cloudless imagery (EOX) with real VIIRS city lights on the night
  side, Natural Earth borders and names, a layer rail, an event feed, details for anything you
  select, and a 7-day timeline that replays recorded observations.
- **Events** (`/events`), **Satellites** (`/satellites`), **Sources** (`/sources`), **About**
  (`/about`) — read pages built from the same live data.

## Data sources

| Source | Used for | Access | Refresh |
| --- | --- | --- | --- |
| NASA EONET v3 | Wildfires, storms, volcanoes, ice, floods… | Open, no key | 10 min |
| USGS Earthquake Hazards | Earthquakes M2.5+, 14 days | Open, no key | 5 min (days 8–14: 6 h) |
| OpenSky Network | Aircraft state vectors | Anonymous (400 credits/day) or OAuth client | 15 min anonymous / 2 min authenticated |
| CelesTrak | Orbital elements (OMM) for SGP4 | Open | 2 h (CelesTrak's request) |
| NASA GIBS | Imagery tiles and event snapshots | Open, no key | Latest times probed every 10 min |
| Open-Meteo | Modelled weather, place search | Open, non-commercial, CC BY 4.0 | On request, cached |
| Natural Earth | Borders, country and city names | Public domain, self-hosted | Static (`public/data`) |

Every provider is reached by the server (except imagery tiles, which browsers load from NASA
directly). The browser never holds a provider credential. See `/sources` for the live state of
each feed and what its status words mean.

## Architecture

```
src/
  app/                 Next.js App Router: globe page, read pages, API routes
    api/               health, sources, events, aircraft (+ track), satellites, imagery, search, weather
  server/              Server-only: provider adapters, collectors, source registry, rate limit
    providers/         eonet, usgs, opensky, celestrak, gibs, openmeteo (zod-validated, normalised)
    collector.ts       On-demand single-flight cache with backoff and Retry-After
    sources.ts         Registry: refresh policy, freshness threshold, health per provider
  components/
    globe/             GlobeEngine (plain TS over Cesium primitives), markers, React wrapper
    explorer/          Globe page UI: top bar, search, layer rail, side panel, timeline…
    site/              Read-page chrome and live fragments
    ui/                Shared primitives (switch, status, satellite snapshot)
  lib/                 Domain types, formatting, geo, SGP4 helpers, palette, client hooks
public/data/           Natural Earth extracts (built by scripts/build-natural-earth.mjs)
tests/                 Vitest unit tests
```

Rendering stays out of React: thousands of aircraft are Cesium billboards and points in
collections, satellites are a point collection propagated once a second, and React talks to the
`GlobeEngine` by method calls. The scene renders on demand (`requestRenderMode`), so an idle globe
costs almost nothing.

Collectors fetch only when someone asks and the cache is due, never run two requests at once,
keep serving the last good copy on failure, and back off exponentially or for exactly as long as a
provider's `Retry-After` says. An idle site spends no provider quota.

## Running locally

Requires Node 20.9+ (developed on Node 24).

```bash
npm install            # copies Cesium's runtime assets into public/cesium
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

npm 11 may hold install scripts for approval; `npm run dev` and `npm run build` copy the Cesium
assets themselves, so this is harmless.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit tests (normalisers, collector, geo, SGP4) |
| `npm run lint` / `npm run typecheck` | ESLint (incl. React Compiler rules) / TypeScript |
| `node scripts/shot.mjs <url> <prefix>` | Screenshots at 1440 and 390 px (Playwright) |
| `node scripts/interact.mjs` | Drives the globe's main interactions and captures each state |

## Configuration

See `.env.example`. Nothing is required for a working site. Optional: OpenSky OAuth client
credentials (`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`) raise the aircraft refresh rate.

## Privacy and limits

No accounts, cookies, analytics or advertising. Recent place searches stay in the visitor's own
browser. Aircraft are shown only by broadcast identifiers; owners are never looked up. A selected
aircraft's short trail comes from at most eight snapshots kept in server memory.

Satellite positions are SGP4 estimates, not tracking. Aircraft positions are as old as the
snapshot shown beside them. Weather is modelled. Event times are the source's observation times.

## Status

The website is complete for local use. Planned next (server phase): PostgreSQL + PostGIS on the
Oracle VM for stored history, Docker Compose, a reverse proxy with HTTPS, and deployment.

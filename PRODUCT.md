# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, TypeScript) website with its own server routes for provider collection, caching and source health. Confirmed by the user over a split FastAPI + PostGIS service. CesiumJS renders the globe. Both the website and all collected data live on the user's Oracle VM: PostgreSQL + PostGIS on the VM stores events, aircraft snapshots (bounded retention), orbital element history and feed health (user, 2026-10-24). Order of work set by the user: build the website first, then the server/database/deployment work. VM access details are still to be provided.

## Users

The curious public: anyone who wants to look at the planet as it is right now — what is burning, shaking, storming, flying overhead and orbiting above. They arrive without training in GIS or orbital mechanics, usually on a laptop or phone, and stay for a few minutes of exploration rather than a working shift.

## Product Purpose

POLARIS is a website that puts public Earth-observation data on a 3D globe: natural events (NASA EONET, USGS earthquakes), aircraft positions (OpenSky Network), satellites estimated from orbital elements (CelesTrak + SGP4), and weather (Open-Meteo). Success is a visitor finding something real happening on Earth, understanding where the information came from, and how old it is.

## Positioning

Honest about its data. Every object on the globe carries its source, its observation time and its freshness, and estimated positions (satellites) are labelled as estimates. When a feed is down the site says so instead of looking full.

## Operating Context

- Visitors land on the globe first; site pages (events, satellites, sources & methodology, about) explain and list what the globe shows.
- Providers have hard limits: anonymous OpenSky allows 400 credits/day (a global snapshot roughly every 15 minutes); CelesTrak updates element sets about every 2 hours and asks not to be polled faster; EONET and USGS are free, unauthenticated feeds.
- The server collects and caches; the browser never talks to providers that need limits enforced and never holds provider secrets.

## Capabilities and Constraints

- Real data only. Simulated content exists only as a labelled local-development adapter and never mixes with live records.
- No person tracking, facial recognition, private-device tracking or movement histories of individuals. Aircraft are shown by public transponder identifiers only, with no owner lookup.
- Historical replay only for observations the site actually stored.
- Undecided: domain name, whether accounts/saved views need server storage, whether India-specific IMD feeds are usable under their terms.

## Brand Commitments

- Name: **POLARIS** — descriptor "World Intelligence System", tagline "Navigate the Bigger Picture." (set by the user 2026-10-24, replacing the working title GOD'S EYE).
- Logo: a dark rounded-square tile holding a tilted silver/chrome elliptical orbit ring that crosses a four-point star. The chrome sheen is part of the brand mark and is kept inside the mark only. Source: the user's reference image; recreated as SVG until the original file is supplied.
- The user pinned a visual direction in the brief: deep midnight ground, graphite and restrained navy surfaces, cool-white type, restrained electric cyan and glacier blue, amber for warnings, red only for critical states, thin subtle borders. The Earth is the visual centrepiece.

## Evidence on Hand

- Live provider feeds verified reachable on 2026-10-24: EONET v3, USGS GeoJSON summary feeds, OpenSky `/states/all` (anonymous), CelesTrak GP JSON, Open-Meteo forecast and geocoding.
- No testimonials, user counts, press or partner logos exist; none may be invented.

## Product Principles

1. Accurate over impressive: never invent an attribute, a severity or a position.
2. Freshness is visible: every value has a time and a source next to it.
3. Partial is normal: the site stays useful when one feed is down, and says which one.
4. The Earth is the interface: lists and pages lead back to a place on the globe.
5. Privacy by design: public, aggregate, permitted data only.

## Accessibility & Inclusion

WCAG 2.1 AA for site chrome and pages; full support for `prefers-reduced-motion`; globe content mirrored in keyboard-accessible lists (event feed, satellite list) so nothing is reachable only by pointing at a 3D canvas.

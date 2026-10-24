"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNow, usePolled, useReducedMotion } from "@/lib/client/usePolled";
import { buildTrack, type SatelliteTrack } from "@/lib/orbits";
import { useNaturalEarth } from "@/lib/client/naturalEarth";
import { countryAt, formatLatLon, type Country } from "@/lib/geo";
import type {
  AircraftPayload,
  EventsPayload,
  ImageryTimes,
  NaturalEvent,
  PlaceResult,
  SatellitesPayload,
  SourceHealth,
} from "@/lib/types";
import type { GlobeEngine, PickInfo, Selection } from "@/components/globe/engine";
import { DEFAULT_LAYERS, MAX_ALTITUDE_M, type LayerState, type WindowDays } from "./state";
import { TopBar } from "./TopBar";
import { LayerRail } from "./LayerRail";
import { SidePanel } from "./SidePanel";
import { Timeline } from "./Timeline";
import { SelectionRing } from "./SelectionRing";
import { GlobeControls } from "./GlobeControls";
import { MobileSheet } from "./MobileSheet";
import type { LocalResult } from "./Search";

const Globe = dynamic(() => import("@/components/globe/Globe"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-ground" aria-hidden />,
});

export type EventsData = EventsPayload & { total: number };

export function Explorer() {
  const reducedMotion = useReducedMotion();
  const [lowPower, setLowPower] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
    return (navigator.hardwareConcurrency ?? 8) <= 4 || memory <= 4;
  });
  const [engine, setEngine] = useState<GlobeEngine | null>(null);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [cursor, setCursor] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [feedOpen, setFeedOpen] = useState(true);
  const [hover, setHover] = useState<(PickInfo & { x: number; y: number }) | null>(null);

  const events = usePolled<EventsData>("/api/events?days=14", 120_000);
  const aircraft = usePolled<AircraftPayload>(layers.aircraft ? "/api/aircraft" : null, 60_000);
  const satellites = usePolled<SatellitesPayload>("/api/satellites", 30 * 60_000);
  const imagery = usePolled<ImageryTimes>("/api/imagery", 10 * 60_000);
  const sources = usePolled<{ sources: SourceHealth[] }>("/api/sources", 60_000);
  const naturalEarth = useNaturalEarth();


  const tracks = useMemo<SatelliteTrack[]>(
    () => (satellites.data?.satellites ?? []).map(buildTrack).filter((t): t is SatelliteTrack => t !== null),
    [satellites.data],
  );

  const now = useNow(60_000);
  const windowStart = now - windowDays * 86_400_000;

  const visibleEvents = useMemo(() => {
    const since = new Date(windowStart).toISOString();
    return (events.data?.events ?? []).filter((e) => layers.categories[e.category] && e.observedAt >= since);
  }, [events.data, layers.categories, windowStart]);

  /* Engine wiring: every effect is a narrow method call, never a re-mount. */

  useEffect(() => {
    if (!engine) return;
    engine.setHandlers({
      onSelect: (s) => {
        setPlace(null);
        setSelection(s);
      },
      onHover: setHover,
    });
  }, [engine]);

  // Deep links from the site's pages: /?event=<id> or /?sat=<NORAD id>, applied once the data is in.
  const deepLink = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    deepLink.current = new URLSearchParams(window.location.search);
  }, []);
  useEffect(() => {
    const params = deepLink.current;
    if (!engine || !params) return;
    const eventId = params.get("event");
    const sat = Number(params.get("sat"));
    if (eventId && events.data) {
      const e = events.data.events.find((x) => x.id === eventId);
      if (e) {
        const days = (Date.now() - Date.parse(e.observedAt)) / 86_400_000;
        if (days > windowDays) setWindowDays(14);
        setSelection({ kind: "event", id: e.id });
      }
      deepLink.current = null;
    } else if (sat && tracks.length) {
      const t = tracks.find((x) => x.noradId === sat);
      if (t) {
        setLayers((l) => ({ ...l, satelliteGroups: { ...l.satelliteGroups, [t.group]: true } }));
        setSelection({ kind: "satellite", id: t.noradId });
      }
      deepLink.current = null;
    }
  }, [engine, events.data, tracks, windowDays]);

  // Clicking open ground identifies the place: Natural Earth country (or open water) and coordinates.
  useEffect(() => {
    if (!engine) return;
    const onPickGround = (point: { lon: number; lat: number } | null) => {
      if (!point) return;
      const country = naturalEarth ? countryAt(point.lon, point.lat, naturalEarth.countries) : null;
      const p: PlaceResult = {
        id: `point:${point.lat.toFixed(3)},${point.lon.toFixed(3)}`,
        name: country?.name ?? "Open water",
        context: formatLatLon(point.lat, point.lon),
        kind: "coordinates",
        lat: point.lat,
        lon: point.lon,
        viewHeight: 0,
      };
      setPlace(p);
      setSelection({ kind: "place", id: p.id, lat: p.lat, lon: p.lon, label: p.name });
    };
    engine.setHandlers({ onPickGround });
  }, [engine, naturalEarth]);

  useEffect(() => {
    if (!engine || !naturalEarth) return;
    engine.setBorders(naturalEarth.borders);
    engine.setPlaceLabels(naturalEarth.countries, naturalEarth.cities, getComputedStyle(document.body).fontFamily);
  }, [engine, naturalEarth]);

  useEffect(() => {
    if (engine && events.data) engine.setEvents(events.data.events);
  }, [engine, events.data]);

  useEffect(() => {
    if (!engine) return;
    const since = new Date(windowStart).toISOString();
    engine.setEventFilter((e) => layers.categories[e.category] && e.observedAt >= since);
  }, [engine, layers.categories, windowStart]);

  useEffect(() => {
    engine?.setTimeCursor(cursor);
  }, [engine, cursor]);

  const lastSnapshot = useRef<number | null>(null);
  useEffect(() => {
    if (!engine || !aircraft.data) return;
    if (aircraft.data.snapshotTime === lastSnapshot.current) return;
    lastSnapshot.current = aircraft.data.snapshotTime;
    engine.setAircraft(aircraft.data.aircraft);
  }, [engine, aircraft.data]);

  useEffect(() => {
    engine?.setAircraftVisible(layers.aircraft);
  }, [engine, layers.aircraft]);

  useEffect(() => {
    if (!engine) return;
    const [lo, hi] = layers.altitude;
    const top = hi >= MAX_ALTITUDE_M ? Infinity : hi;
    engine.setAircraftFilter((r) => {
      if (r[7]) return layers.ground;
      const alt = r[6] ?? r[5];
      if (alt === null) return lo === 0;
      return (lo === 0 || alt >= lo) && alt <= top;
    });
  }, [engine, layers.altitude, layers.ground]);

  useEffect(() => {
    if (engine) engine.setSatellites(tracks);
  }, [engine, tracks]);

  useEffect(() => {
    if (!engine) return;
    const anyOn = Object.values(layers.satelliteGroups).some(Boolean);
    engine.setSatelliteFilter((t) => layers.satelliteGroups[t.group] ?? false);
    engine.setSatellitesVisible(anyOn);
  }, [engine, layers.satelliteGroups, tracks]);

  useEffect(() => {
    if (engine && imagery.data) engine.setImageryTimes(imagery.data.layers);
  }, [engine, imagery.data]);

  useEffect(() => {
    if (!engine) return;
    for (const [key, on] of Object.entries(layers.imagery)) engine.setImagery(key as keyof LayerState["imagery"], on);
  }, [engine, layers.imagery]);

  useEffect(() => {
    engine?.select(selection);
  }, [engine, selection]);

  useEffect(() => {
    if (!engine) return;
    const frame = requestAnimationFrame(() => engine.refreshOcclusion());
    return () => cancelAnimationFrame(frame);
  }, [engine, selection, feedOpen]);

  // Aircraft trail: positions this server stored on earlier snapshots.
  useEffect(() => {
    if (!engine || selection?.kind !== "aircraft") return;
    const ctrl = new AbortController();
    fetch(`/api/aircraft/track?icao24=${selection.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { samples: { lon: number; lat: number; altitudeM: number | null }[] } | null) => {
        if (body?.samples.length) engine.showAircraftTrail(body.samples);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [engine, selection, aircraft.data?.snapshotTime]);

  const selectEvent = useCallback((e: NaturalEvent) => {
    setPlace(null);
    setSelection({ kind: "event", id: e.id });
  }, []);

  const selectPlace = useCallback(
    (p: PlaceResult) => {
      setPlace(p);
      setSelection({ kind: "place", id: p.id, lat: p.lat, lon: p.lon, label: p.name });
      engine?.flyToPlace(p.lon, p.lat, p.viewHeight);
    },
    [engine],
  );

  // Search also matches what is already on the globe: satellites, flights, events.
  const findLocal = useCallback(
    (q: string): LocalResult[] => {
      const needle = q.toLowerCase();
      const out: LocalResult[] = [];
      for (const t of tracks) {
        if (out.length >= 4) break;
        if (t.name.toLowerCase().includes(needle) || String(t.noradId) === needle) {
          out.push({
            id: `sat:${t.noradId}`,
            label: t.name,
            context: `Satellite · NORAD ${t.noradId}`,
            kind: "satellite",
            select: () => {
              setLayers((l) => ({ ...l, satelliteGroups: { ...l.satelliteGroups, [t.group]: true } }));
              setPlace(null);
              setSelection({ kind: "satellite", id: t.noradId });
            },
          });
        }
      }
      const upper = q.toUpperCase().replace(/\s+/g, "");
      let flights = 0;
      for (const r of aircraft.data?.aircraft ?? []) {
        if (flights >= 3) break;
        if (r[1]?.startsWith(upper) || r[0] === q.toLowerCase()) {
          flights++;
          out.push({
            id: `air:${r[0]}`,
            label: r[1] ?? r[0].toUpperCase(),
            context: `Flight · ${r[2]}`,
            kind: "aircraft",
            select: () => {
              setPlace(null);
              setSelection({ kind: "aircraft", id: r[0] });
            },
          });
        }
      }
      let found = 0;
      for (const e of events.data?.events ?? []) {
        if (found >= 3) break;
        if (e.title.toLowerCase().includes(needle)) {
          found++;
          out.push({
            id: e.id,
            label: e.title,
            context: "Event",
            kind: "event",
            select: () => selectEvent(e),
          });
        }
      }
      return out;
    },
    [tracks, aircraft.data, events.data, selectEvent],
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    setPlace(null);
  }, []);

  // Escape clears the selection (no animation on the keyboard path).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  const shared = {
    layers,
    setLayers,
    events,
    visibleEvents,
    aircraft,
    satellites,
    tracks,
    imagery,
    sources: sources.data?.sources ?? null,
    windowDays,
    setWindowDays,
    selection,
    place,
    engine,
    selectEvent,
    setSelection,
    clearSelection,
    countries: naturalEarth?.countries ?? null,
    feedOpen,
    setFeedOpen,
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-ground text-ink">
      <div className="absolute inset-x-0 top-0 bottom-0 max-md:bottom-[calc(46svh-14px)]">
        <Globe reducedMotion={reducedMotion} lowPower={lowPower} onReady={setEngine} />
      </div>

      <SelectionRing engine={engine} selection={selection} reducedMotion={reducedMotion} />
      {hover && !selection && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 truncate rounded-[var(--radius-control)] bg-raised px-2 py-1 text-xs text-ink shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
          style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 12}px)`, left: 0, top: 0 }}
        >
          {hover.label}
        </div>
      )}

      <TopBar
        sources={shared.sources}
        onPlace={selectPlace}
        findLocal={findLocal}
        onRefreshSources={sources.refresh}
        lowPower={lowPower}
        setLowPower={setLowPower}
      />

      <div className="hidden md:block">
        <LayerRail {...shared} />
        <SidePanel {...shared} />
        <Timeline
          events={visibleEvents}
          windowDays={windowDays}
          setWindowDays={setWindowDays}
          cursor={cursor}
          setCursor={setCursor}
          reducedMotion={reducedMotion}
          loading={events.loading && !events.data}
        />
      </div>

      <GlobeControls engine={engine} />

      <div className="md:hidden">
        <MobileSheet {...shared} />
      </div>
    </div>
  );
}

export type ExplorerShared = {
  layers: LayerState;
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
  events: ReturnType<typeof usePolled<EventsData>>;
  visibleEvents: NaturalEvent[];
  aircraft: ReturnType<typeof usePolled<AircraftPayload>>;
  satellites: ReturnType<typeof usePolled<SatellitesPayload>>;
  tracks: SatelliteTrack[];
  imagery: ReturnType<typeof usePolled<ImageryTimes>>;
  sources: SourceHealth[] | null;
  windowDays: WindowDays;
  setWindowDays: (d: WindowDays) => void;
  selection: Selection | null;
  place: PlaceResult | null;
  engine: GlobeEngine | null;
  selectEvent: (e: NaturalEvent) => void;
  setSelection: (s: Selection | null) => void;
  clearSelection: () => void;
  countries: Country[] | null;
  feedOpen: boolean;
  setFeedOpen: (open: boolean) => void;
};

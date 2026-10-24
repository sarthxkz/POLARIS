"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { CATEGORY_LABEL } from "@/lib/categories";
import { CRITICAL_MAGNITUDE } from "@/lib/palette";
import { countryAt, formatLatLon, haversineKm, type Country } from "@/lib/geo";
import {
  formatAge,
  formatAltitude,
  formatCount,
  formatDuration,
  formatHeading,
  formatNumber,
  formatSpeed,
  formatUtc,
  unitLabel,
} from "@/lib/format";
import { elementAgeHours, estimate, orbitClass, type SatelliteTrack } from "@/lib/orbits";
import { useNow } from "@/lib/client/usePolled";
import type { AircraftPayload, AircraftRow, NaturalEvent, PlaceResult } from "@/lib/types";
import { Field } from "@/components/ui/primitives";
import { CategoryGlyph } from "./LayerRail";
import { WeatherCard } from "./WeatherCard";
import { SatelliteView } from "@/components/ui/SatelliteView";

function Heading({ title, meta, children }: { title: string; meta: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-4 pt-1 pb-3">
      <h2 className="text-lg leading-snug font-medium text-ink">{title}</h2>
      <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-soft">{meta}</div>
      {children}
    </div>
  );
}

function Fields({ children }: { children: ReactNode }) {
  return <dl className="border-t border-line px-4 py-2 text-[13px]">{children}</dl>;
}

function Caveat({ children }: { children: ReactNode }) {
  return <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-faint">{children}</p>;
}

function Links({ links }: { links: { label: string; url: string }[] }) {
  if (!links.length) return null;
  return (
    <ul className="border-t border-line px-2.5 py-2">
      {links.map((l) => (
        <li key={l.url}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[6px] px-1.5 py-1.5 text-[13px] text-ink-soft hover:bg-hover hover:text-ink"
          >
            <ExternalLink aria-hidden size={13} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{l.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Events within `radiusKm` of a point in the current window: region-level correlation, nothing inferred. */
function Nearby({
  lat,
  lon,
  events,
  exclude,
  onSelect,
  radiusKm = 500,
}: {
  lat: number;
  lon: number;
  events: NaturalEvent[];
  exclude?: string;
  onSelect: (e: NaturalEvent) => void;
  radiusKm?: number;
}) {
  const near = useMemo(
    () =>
      events
        .filter((e) => e.id !== exclude)
        .map((e) => ({ e, km: haversineKm(lat, lon, e.lat, e.lon) }))
        .filter((x) => x.km <= radiusKm)
        .sort((a, b) => a.km - b.km)
        .slice(0, 6),
    [events, lat, lon, exclude, radiusKm],
  );
  return (
    <section className="border-t border-line px-1.5 py-3">
      <h3 className="px-2.5 text-[13px] font-medium text-ink">
        Other events within {formatCount(radiusKm)} km
      </h3>
      {near.length === 0 ? (
        <p className="px-2.5 pt-1.5 text-[13px] text-ink-faint">None in the current time window and layers.</p>
      ) : (
        <ul className="mt-1">
          {near.map(({ e, km }) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left hover:bg-hover"
              >
                <CategoryGlyph category={e.category} size={14} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{e.title}</span>
                <span className="num shrink-0 text-xs text-ink-faint">{formatCount(Math.round(km))} km</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────────────────────── Event ───────────────────────────── */

export function EventDetail({
  event: e,
  events,
  onSelect,
}: {
  event: NaturalEvent;
  events: NaturalEvent[];
  onSelect: (e: NaturalEvent) => void;
}) {
  const now = useNow(30_000);
  const critical = e.category === "earthquakes" && (e.magnitude?.value ?? 0) >= CRITICAL_MAGNITUDE;
  return (
    <>
      <Heading
        title={e.title}
        meta={
          <>
            <CategoryGlyph category={e.category} size={15} magnitude={e.magnitude?.value} />
            <span>{CATEGORY_LABEL[e.category]}</span>
            {e.status && (
              <span className="text-ink-faint">
                · {e.provider === "usgs" ? `${e.status} solution` : e.status === "open" ? "ongoing" : "closed"}
              </span>
            )}
          </>
        }
      >
        {critical && (
          <p className="mt-2 text-[13px] text-red">
            Magnitude 6 and above can cause significant damage in populated areas. Check USGS for felt reports and impact estimates.
          </p>
        )}
      </Heading>
      <Fields>
        {e.magnitude && (
          <Field label={e.category === "earthquakes" ? "Magnitude" : "Reported size"}>
            {e.category === "earthquakes"
              ? `${e.magnitude.value.toFixed(1)}, ${e.magnitude.unit.replace(/^M/, "")} scale`
              : `${formatNumber(e.magnitude.value, e.magnitude.value % 1 ? 1 : 0)} ${unitLabel(e.magnitude.unit)}`}
          </Field>
        )}
        {e.depthKm !== undefined && e.depthKm !== null && <Field label="Depth">{formatNumber(e.depthKm, 1)} km</Field>}
        <Field label={e.approximate ? "Approx. centre" : "Location"} hint={e.approximate ? "Centre of the reported area" : undefined}>
          {formatLatLon(e.lat, e.lon)}
        </Field>
        {e.description && e.description !== e.title && <Field label="Description">{e.description}</Field>}
        <Field label={e.track.length > 1 ? "First observed" : "Observed"} hint={formatAge(e.startedAt, now)}>
          {formatUtc(e.startedAt)}
        </Field>
        {e.track.length > 1 && (
          <Field label="Last observed" hint={formatAge(e.observedAt, now)}>
            {formatUtc(e.observedAt)}
          </Field>
        )}
        {e.track.length > 1 && (
          <Field label="Track">
            {formatCount(e.track.length)} positions, drawn on the globe
          </Field>
        )}
        {e.provider === "usgs" && (
          <>
            <Field label="Tsunami flag">{e.tsunami ? "Yes — see USGS and tsunami warning centres" : "No"}</Field>
            {e.alert && <Field label="PAGER alert">{e.alert}</Field>}
            {e.providerUpdatedAt && <Field label="USGS updated">{formatUtc(e.providerUpdatedAt)}</Field>}
          </>
        )}
        <Field label="Source">{e.provider === "usgs" ? "USGS Earthquake Hazards Program" : "NASA EONET"}</Field>
      </Fields>
      <Links links={e.links} />
      <section className="border-t border-line px-4 py-3.5">
        <h3 className="mb-2 text-[13px] font-medium text-ink">Seen from orbit</h3>
        <SatelliteView
          lat={e.lat}
          lon={e.lon}
          observedAt={e.observedAt}
          spanDeg={e.category === "severeStorms" ? 12 : e.category === "seaLakeIce" ? 8 : 3}
          sizes={480}
        />
      </section>
      <WeatherCard lat={e.lat} lon={e.lon} />
      <Nearby lat={e.lat} lon={e.lon} events={events} exclude={e.id} onSelect={onSelect} />
      <Caveat>
        {e.provider === "usgs"
          ? "Automatic solutions are revised by USGS seismologists; magnitude and location can change after review."
          : "EONET lists events curated from its sources; dates and positions are those sources' observations, not a live feed."}
      </Caveat>
    </>
  );
}

/* ───────────────────────────── Aircraft ───────────────────────────── */

export function AircraftDetail({ row, payload }: { row: AircraftRow; payload: AircraftPayload }) {
  const now = useNow(10_000);
  const [icao24, callsign, country, lon, lat, baro, geo, onGround, velocity, track, vrate, timePosition, lastContact] = row;
  const snapshot = payload.snapshotTime ? payload.snapshotTime * 1000 : null;
  return (
    <>
      <Heading
        title={callsign ?? "No callsign broadcast"}
        meta={
          <>
            <span className="num">ICAO 24-bit address {icao24.toUpperCase()}</span>
          </>
        }
      />
      <Fields>
        <Field label="Registered in">{country}</Field>
        <Field label="Position">{formatLatLon(lat, lon, 3)}</Field>
        <Field label="State">{onGround ? "On the ground" : "Airborne"}</Field>
        <Field label="Barometric alt.">{formatAltitude(baro)}</Field>
        <Field label="Geometric alt.">{formatAltitude(geo)}</Field>
        <Field label="Ground speed">{formatSpeed(velocity)}</Field>
        <Field label="Track">{formatHeading(track)}</Field>
        <Field label="Vertical rate">
          {vrate === null ? "—" : `${vrate > 0 ? "+" : ""}${formatNumber(vrate * 196.85)} ft/min`}
        </Field>
        <Field label="Position time" hint={timePosition ? formatAge(timePosition * 1000, now) : undefined}>
          {timePosition ? formatUtc(timePosition * 1000, true) : "—"}
        </Field>
        <Field label="Last message" hint={formatAge(lastContact * 1000, now)}>
          {formatUtc(lastContact * 1000, true)}
        </Field>
        <Field label="Snapshot" hint={snapshot ? `Next in about ${Math.max(0, Math.round((snapshot + payload.refreshSeconds * 1000 - now) / 60000))} min` : undefined}>
          {snapshot ? formatUtc(snapshot) : "—"}
        </Field>
      </Fields>
      <Links
        links={[
          {
            label: "OpenSky aircraft record",
            url: `https://opensky-network.org/aircraft-profile?icao24=${icao24}`,
          },
        ]}
      />
      <Caveat>
        Positions come from ADS-B and Mode S receivers run by OpenSky volunteers. Coverage is uneven over oceans and
        some regions, and this snapshot is up to {Math.round(payload.refreshSeconds / 60)} minutes old, so the aircraft
        has moved since. The cyan line joins positions this server saw on earlier snapshots. POLARIS shows broadcast
        identifiers only and does not look up owners or passengers.
      </Caveat>
    </>
  );
}

/* ───────────────────────────── Satellite ───────────────────────────── */

export function SatelliteDetail({ track, retrievedAt }: { track: SatelliteTrack; retrievedAt: string | null }) {
  const now = new Date(useNow(1000));
  const state = estimate(track, now);
  const el = track.elements;
  const ageH = elementAgeHours(el, now.getTime());
  const epoch = el.EPOCH.endsWith("Z") ? el.EPOCH : `${el.EPOCH}Z`;
  return (
    <>
      <Heading
        title={track.name}
        meta={
          <span className="num">
            NORAD {el.NORAD_CAT_ID} · {el.OBJECT_ID}
          </span>
        }
      />
      <Fields>
        <Field label="Estimated at" hint="Updates every second">
          {formatUtc(now, true)}
        </Field>
        <Field label="Sub-point">{state ? formatLatLon(state.lat, state.lon) : "—"}</Field>
        <Field label="Altitude">{state ? `${formatNumber(state.altitudeKm)} km` : "—"}</Field>
        <Field label="Speed">{state ? `${formatNumber(state.speedKms, 2)} km/s` : "—"}</Field>
        <Field label="Orbit">{state ? orbitClass(state.altitudeKm) : "—"}</Field>
        <Field label="Period">{formatDuration(track.periodMinutes)}</Field>
        <Field label="Inclination">{formatNumber(el.INCLINATION, 2)}°</Field>
        <Field label="Eccentricity">{el.ECCENTRICITY.toFixed(5)}</Field>
        <Field label="Element epoch" hint={`${formatNumber(ageH, 1)} hours before now`}>
          {formatUtc(epoch)}
        </Field>
        <Field label="Elements fetched">{retrievedAt ? formatUtc(retrievedAt) : "—"}</Field>
      </Fields>
      <Links
        links={[
          { label: "CelesTrak catalogue record", url: `https://celestrak.org/satcat/table-satcat.php?CATNR=${el.NORAD_CAT_ID}&FORMAT=` },
        ]}
      />
      <Caveat>
        This is an SGP4 estimate from published orbital elements, not live tracking. Error grows the further we are from
        the element epoch (typically about a kilometre a day for low orbits) and jumps when a satellite manoeuvres. The
        blue line is the path over the next orbit, drawn relative to the turning Earth.
        {ageH > 72 && " These elements are more than three days old, so expect larger error."}
      </Caveat>
    </>
  );
}

/* ───────────────────────────── Place ───────────────────────────── */

export function PlaceDetail({
  place,
  events,
  onSelect,
  countries,
}: {
  place: PlaceResult;
  events: NaturalEvent[];
  onSelect: (e: NaturalEvent) => void;
  countries: Country[] | null;
}) {
  const country = useMemo(
    () => (countries ? countryAt(place.lon, place.lat, countries) : null),
    [countries, place.lat, place.lon],
  );
  const inCountry = useMemo(
    () => (country ? events.filter((e) => countryAt(e.lon, e.lat, [country]) !== null) : []),
    [events, country],
  );
  return (
    <>
      <Heading title={place.name} meta={<span>{place.kind === "coordinates" ? "Location" : place.context}</span>} />
      <Fields>
        <Field label="Coordinates">{formatLatLon(place.lat, place.lon, 4)}</Field>
        {country && country.name !== place.name && <Field label="Country">{country.name}</Field>}
      </Fields>
      {country && (
        <section className="border-t border-line px-1.5 py-3">
          <h3 className="px-2.5 text-[13px] font-medium text-ink">
            Events in {country.name}{" "}
            <span className="num font-normal text-ink-faint">· {formatCount(inCountry.length)}</span>
          </h3>
          {inCountry.length === 0 ? (
            <p className="px-2.5 pt-1.5 text-[13px] text-ink-faint">None in the current time window and layers.</p>
          ) : (
            <ul className="mt-1">
              {inCountry.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(e)}
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left hover:bg-hover"
                  >
                    <CategoryGlyph category={e.category} size={14} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="px-2.5 pt-1.5 text-xs text-ink-faint">
            Matched against simplified Natural Earth outlines, so events right on a coast or border can be missed.
          </p>
        </section>
      )}
      <WeatherCard lat={place.lat} lon={place.lon} />
      <Nearby lat={place.lat} lon={place.lon} events={events} onSelect={onSelect} radiusKm={800} />
    </>
  );
}

export function MissingSelection({ what, onBack }: { what: string; onBack: () => void }) {
  return (
    <div className="px-4 py-4 text-[13px] text-ink-soft">
      <p>This {what} is no longer in the latest data.</p>
      <button type="button" onClick={onBack} className="press mt-2 text-ink underline underline-offset-2">
        Back to the event list
      </button>
    </div>
  );
}


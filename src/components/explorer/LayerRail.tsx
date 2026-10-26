"use client";

import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { CATEGORY_LABEL } from "@/lib/categories";
import { CATEGORY_COLOR, DATA } from "@/lib/palette";
import { formatAge, formatCount, formatUtc, formatUtcShort } from "@/lib/format";
import { useNow } from "@/lib/client/usePolled";
import type { EventCategory } from "@/lib/types";
import type { ImageryKey } from "@/components/globe/engine";
import { CategoryGlyph } from "@/components/ui/CategoryGlyph";
import { cx, Notice, Skeleton, Switch } from "@/components/ui/primitives";
import { CATEGORY_GROUPS, MAX_ALTITUDE_M, WINDOWS } from "./state";

export { CategoryGlyph };
import type { ExplorerShared } from "./Explorer";

function Section({
  title,
  meta,
  children,
  defaultOpen = true,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 pt-3.5 pb-2 text-left"
      >
        <h2 className="flex-1 text-[13px] font-medium text-ink">{title}</h2>
        {meta && <span className="text-xs text-ink-faint">{meta}</span>}
        <ChevronDown
          aria-hidden
          size={14}
          strokeWidth={1.5}
          className={cx("text-ink-faint transition-transform duration-200 ease-[var(--ease-out)]", open ? "" : "-rotate-90")}
        />
      </button>
      {open && <div className="px-1.5 pb-3">{children}</div>}
    </section>
  );
}

function LayerRow({
  on,
  onToggle,
  icon,
  label,
  count,
  detail,
  color,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  label: string;
  count?: ReactNode;
  detail?: ReactNode;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-[6px] text-left transition-colors duration-150 hover:bg-hover disabled:opacity-50"
    >
      {icon && <span className={cx("grid w-4 place-items-center", on ? "" : "opacity-45")}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate", on ? "text-ink" : "text-ink-soft")}>{label}</span>
        {detail && <span className="block truncate text-xs text-ink-faint">{detail}</span>}
      </span>
      {count !== undefined && <span className="num text-[13px] text-ink-soft">{count}</span>}
      <Switch on={on} color={color} />
    </button>
  );
}

const ALTITUDE_BANDS: { label: string; range: [number, number] }[] = [
  { label: "All", range: [0, MAX_ALTITUDE_M] },
  { label: "< 3 km", range: [0, 3_000] },
  { label: "3–9 km", range: [3_000, 9_000] },
  { label: "> 9 km", range: [9_000, MAX_ALTITUDE_M] },
];

const IMAGERY: { key: ImageryKey; label: string; detail: (t: Record<string, string | null>) => string }[] = [
  { key: "nightLights", label: "City lights at night", detail: () => "VIIRS Black Marble, 2016 composite" },
  {
    key: "trueColor",
    label: "Today's true colour",
    detail: (t) => {
      const v = t["VIIRS_SNPP_CorrectedReflectance_TrueColor"];
      return v ? `VIIRS swaths, ${v.slice(0, 10)}` : "VIIRS daily swaths";
    },
  },
  {
    key: "clouds",
    label: "Cloud infrared",
    detail: (t) => {
      const v = t["GOES-East_ABI_Band13_Clean_Infrared"];
      return v ? `GOES and Himawari, ${formatUtcShort(v)} UTC` : "GOES and Himawari";
    },
  },
  {
    key: "precipitation",
    label: "Precipitation rate",
    detail: (t) => {
      const v = t["IMERG_Precipitation_Rate_30min"];
      return v ? `GPM IMERG, ${formatUtcShort(v)} UTC` : "GPM IMERG, 30-minute";
    },
  },
  { key: "borders", label: "Country borders", detail: () => "Natural Earth, 1:50m" },
  { key: "labels", label: "Country and city names", detail: () => "Natural Earth" },
];

export function LayerRail(props: ExplorerShared & { embedded?: boolean }) {
  const { layers, setLayers, events, aircraft, satellites, imagery, windowDays, setWindowDays, embedded, railOpen, setRailOpen } =
    props;
  const now = useNow(30_000);

  const counts = useMemo(() => {
    const since = new Date(now - windowDays * 86_400_000).toISOString();
    const c = {} as Record<EventCategory, number>;
    for (const e of events.data?.events ?? []) {
      if (e.observedAt >= since) c[e.category] = (c[e.category] ?? 0) + 1;
    }
    return c;
  }, [events.data, windowDays, now]);

  const aircraftCount = useMemo(() => {
    const rows = aircraft.data?.aircraft ?? [];
    const [lo, hi] = layers.altitude;
    const top = hi >= MAX_ALTITUDE_M ? Infinity : hi;
    let airborne = 0;
    let shown = 0;
    for (const r of rows) {
      if (r[7]) continue;
      airborne++;
      const alt = r[6] ?? r[5];
      if (alt === null ? lo === 0 : (lo === 0 || alt >= lo) && alt <= top) shown++;
    }
    return { airborne, shown };
  }, [aircraft.data, layers.altitude]);

  const toggleCategory = (c: EventCategory) =>
    setLayers((l) => ({ ...l, categories: { ...l.categories, [c]: !l.categories[c] } }));

  const eventsLoading = events.loading && !events.data;
  const eventSourcesDown = events.data?.sources.filter((s) => s.status === "down") ?? [];
  const groupsWithData = CATEGORY_GROUPS.map((g) => ({
    ...g,
    categories: g.categories.filter((c) => counts[c] || c === "wildfires" || c === "earthquakes" || c === "severeStorms" || c === "volcanoes"),
  }));
  const quietCategories = CATEGORY_GROUPS.flatMap((g) => g.categories).filter(
    (c) => !groupsWithData.some((g) => g.categories.includes(c)),
  );

  const snapshot = aircraft.data?.snapshotTime ? aircraft.data.snapshotTime * 1000 : null;

  if (!embedded && !railOpen) {
    return (
      <button
        type="button"
        data-occludes-globe
        onClick={() => setRailOpen(true)}
        aria-expanded={false}
        className="press intro-left absolute top-[calc(var(--bar-h)+4px)] left-3 z-20 flex items-center gap-2 rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-2 text-[13px] text-ink hover:bg-hover"
      >
        <PanelLeftOpen aria-hidden size={15} strokeWidth={1.5} className="text-ink-soft" />
        Layers
      </button>
    );
  }

  return (
    <aside
      data-occludes-globe
      aria-label="Layers"
      className={cx(
        "absolute top-[calc(var(--bar-h)+4px)] bottom-[calc(var(--timeline-h)+20px)] left-3 z-20 flex w-[var(--rail-w)] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface",
        !embedded && "intro-left",
      )}
    >
      {!embedded && (
        <div className="flex items-center justify-between border-b border-line py-1.5 pr-1.5 pl-3.5">
          <span className="text-[13px] font-medium text-ink">Layers</span>
          <button
            type="button"
            onClick={() => setRailOpen(false)}
            aria-label="Hide the layer list"
            title="Hide the layer list"
            className="press grid size-7 place-items-center rounded-[6px] text-ink-faint hover:bg-hover hover:text-ink"
          >
            <PanelLeftClose size={15} strokeWidth={1.5} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Section
          title="Natural events"
          meta={
            <span className="num">
              {eventsLoading ? "…" : formatCount(Object.values(counts).reduce((a, b) => a + b, 0))}
            </span>
          }
        >
          <div className="mb-2 flex gap-1 px-2" role="radiogroup" aria-label="Observed in the last">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                role="radio"
                aria-checked={windowDays === w.days}
                onClick={() => setWindowDays(w.days)}
                className={cx(
                  "press flex-1 rounded-[6px] py-1 text-xs",
                  windowDays === w.days ? "bg-raised text-ink" : "text-ink-faint hover:text-ink-soft",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          {eventsLoading ? (
            <div className="space-y-2.5 px-2 py-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3.5 w-6" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {groupsWithData.map((g) =>
                g.categories.length === 0 ? null : (
                  <div key={g.label} className="mt-1">
                    <div className="px-2 pt-1.5 pb-1 text-xs text-ink-faint">{g.label}</div>
                    {g.categories.map((c) => (
                      <LayerRow
                        key={c}
                        on={layers.categories[c]}
                        onToggle={() => toggleCategory(c)}
                        icon={<CategoryGlyph category={c} />}
                        label={CATEGORY_LABEL[c]}
                        count={formatCount(counts[c] ?? 0)}
                        color={CATEGORY_COLOR[c]}
                        detail={c === "earthquakes" ? "USGS, M2.5 and above" : undefined}
                      />
                    ))}
                  </div>
                ),
              )}
              {quietCategories.length > 0 && (
                <p className="px-2 pt-2 text-xs text-ink-faint">
                  No {quietCategories.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(", ")} reported in this window.
                </p>
              )}
            </>
          )}
          {events.error && !events.data && (
            <div className="px-2 pt-2">
              <Notice tone="error" action={<RetryButton onClick={events.refresh} />}>
                Couldn’t load natural events. {events.error}
              </Notice>
            </div>
          )}
          {eventSourcesDown.length > 0 && (
            <div className="px-2 pt-2">
              <Notice tone="warning">
                {eventSourcesDown.map((s) => (s.id === "usgs" ? "USGS" : "NASA EONET")).join(" and ")} unavailable;
                showing what the other source reports.
              </Notice>
            </div>
          )}
          {events.data?.retrievedAt && (
            <p className="num px-2 pt-2 text-xs text-ink-faint">
              NASA EONET and USGS · retrieved {formatAge(events.data.retrievedAt, now)}
            </p>
          )}
        </Section>

        <Section
          title="Aircraft"
          meta={<span className="num">{aircraft.data ? formatCount(aircraftCount.shown) : layers.aircraft ? "…" : "off"}</span>}
        >
          <LayerRow
            on={layers.aircraft}
            onToggle={() => setLayers((l) => ({ ...l, aircraft: !l.aircraft }))}
            icon={<PlaneGlyph />}
            label="Aircraft in flight"
            count={aircraft.data ? formatCount(aircraftCount.airborne) : undefined}
            color={DATA.aircraft}
            detail={
              snapshot
                ? `Snapshot ${formatAge(snapshot, now)}`
                : layers.aircraft && aircraft.loading
                  ? "Loading OpenSky snapshot…"
                  : undefined
            }
          />
          {layers.aircraft && (
            <>
              <div className="mt-1.5 flex gap-1 px-2" role="radiogroup" aria-label="Altitude">
                {ALTITUDE_BANDS.map((b) => {
                  const active = layers.altitude[0] === b.range[0] && layers.altitude[1] === b.range[1];
                  return (
                    <button
                      key={b.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setLayers((l) => ({ ...l, altitude: b.range }))}
                      className={cx(
                        "press flex-1 rounded-[6px] py-1 text-xs",
                        active ? "bg-raised text-ink" : "text-ink-faint hover:text-ink-soft",
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <LayerRow
                on={layers.ground}
                onToggle={() => setLayers((l) => ({ ...l, ground: !l.ground }))}
                label="Include aircraft on the ground"
                color={DATA.aircraft}
              />
              {aircraft.data?.health.status === "limited" || aircraft.data?.health.lastError ? (
                <div className="px-2 pt-1.5">
                  <Notice tone="warning">
                    {aircraft.data.health.lastError}
                    {aircraft.data.health.nextAttempt && (
                      <> Next try {formatUtcShort(aircraft.data.health.nextAttempt)} UTC.</>
                    )}
                  </Notice>
                </div>
              ) : null}
              {aircraft.error && !aircraft.data && (
                <div className="px-2 pt-1.5">
                  <Notice tone="error" action={<RetryButton onClick={aircraft.refresh} />}>
                    Couldn’t load aircraft. {aircraft.error}
                  </Notice>
                </div>
              )}
              {aircraft.data && aircraft.data.aircraft.length === 0 && !aircraft.data.health.lastError && (
                <p className="px-2 pt-1.5 text-xs text-ink-faint">OpenSky returned no positions in this snapshot.</p>
              )}
              <p className="px-2 pt-2 text-xs text-ink-faint">
                Drawn when you zoom closer than about 9,000 km, so they do not blanket the whole planet.
              </p>
              <p className="px-2 pt-1.5 text-xs text-ink-faint">
                OpenSky Network, {aircraft.data?.access ?? "anonymous"} access
                {snapshot ? `, snapshot ${formatUtcShort(snapshot)} UTC` : ""} · refreshed every{" "}
                {Math.round((aircraft.data?.refreshSeconds ?? 900) / 60)} min
              </p>
            </>
          )}
        </Section>

        <Section
          title="Satellites"
          meta={<span className="num">{satellites.data ? formatCount(props.tracks.filter((t) => layers.satelliteGroups[t.group]).length) : "…"}</span>}
        >
          {satellites.loading && !satellites.data ? (
            <div className="space-y-2.5 px-2 py-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="block h-3.5 w-full" />
              ))}
            </div>
          ) : (
            satellites.data?.groups.map((g) => (
              <LayerRow
                key={g.id}
                on={layers.satelliteGroups[g.id] ?? false}
                onToggle={() =>
                  setLayers((l) => ({
                    ...l,
                    satelliteGroups: { ...l.satelliteGroups, [g.id]: !l.satelliteGroups[g.id] },
                  }))
                }
                icon={<span className="size-[7px] rounded-full" style={{ backgroundColor: DATA.satellite }} />}
                label={g.label}
                count={g.count === 0 ? "—" : formatCount(g.count)}
                color={DATA.satellite}
              />
            ))
          )}
          {satellites.error && !satellites.data && (
            <div className="px-2 pt-1.5">
              <Notice tone="error" action={<RetryButton onClick={satellites.refresh} />}>
                Couldn’t load orbital elements. {satellites.error}
              </Notice>
            </div>
          )}
          <LayerRow
            on={layers.satTrails}
            onToggle={() => setLayers((l) => ({ ...l, satTrails: !l.satTrails }))}
            label="Recent paths"
            detail="Each satellite's last three minutes"
          />
          <p className="px-2 pt-2 text-xs text-ink-faint">
            Positions estimated each second with SGP4 from CelesTrak elements
            {satellites.data?.retrievedAt ? `, retrieved ${formatAge(satellites.data.retrievedAt, now)}` : ""}. Estimates,
            not tracking.
          </p>
        </Section>

        <Section title="Imagery and weather" defaultOpen>
          {IMAGERY.map((item) => (
            <LayerRow
              key={item.key}
              on={layers.imagery[item.key]}
              onToggle={() =>
                setLayers((l) => ({ ...l, imagery: { ...l.imagery, [item.key]: !l.imagery[item.key] } }))
              }
              label={item.label}
              detail={item.detail(imagery.data?.layers ?? {})}
            />
          ))}
          {layers.imagery.clouds && (
            <p className="px-2 pt-1.5 text-xs text-ink-faint">
              Cloud infrared covers the Americas, Pacific and East Asia; Europe, Africa and the Indian Ocean have no
              geostationary coverage in this set.
            </p>
          )}
          {layers.imagery.precipitation && imagery.data?.layers["IMERG_Precipitation_Rate_30min"] && (
            <p className="px-2 pt-1.5 text-xs text-ink-faint">
              Satellite-estimated rain rate for{" "}
              {formatUtc(imagery.data.layers["IMERG_Precipitation_Rate_30min"]!)}; IMERG is published a few hours after
              observation.
            </p>
          )}
          <p className="px-2 pt-2 text-xs text-ink-faint">
            Base imagery: Sentinel-2 cloudless 2024 by EOX, from Copernicus data.
          </p>
        </Section>
      </div>
    </aside>
  );
}

function PlaneGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.2c.7 0 1.2.9 1.2 2.1v5.2l7.6 4.4v2l-7.6-2.3v4.8l2.2 1.7v1.6L12 21l-3.4.9v-1.6l2.2-1.7v-4.8l-7.6 2.3v-2l7.6-4.4V4.3c0-1.2.5-2.1 1.2-2.1z"
        fill={DATA.aircraft}
      />
    </svg>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press shrink-0 text-xs text-ink underline underline-offset-2">
      Retry
    </button>
  );
}

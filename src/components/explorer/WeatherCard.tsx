"use client";

import { useEffect, useState } from "react";
import { formatAge, formatHeading, formatNumber, formatUtcShort } from "@/lib/format";
import type { WeatherNow } from "@/lib/types";
import { Notice, Skeleton } from "@/components/ui/primitives";

/** WMO weather interpretation codes, as documented by Open-Meteo. */
const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

export function WeatherCard({ lat, lon }: { lat: number; lon: number }) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const [result, setResult] = useState<{ key: string; data: WeatherNow | null; error: string | null } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/weather?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Weather is unavailable right now.");
        setResult({ key, data: body as WeatherNow, error: null });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setResult({ key, data: null, error: e.message });
      });
    return () => ctrl.abort();
  }, [key, lat, lon]);

  const current = result?.key === key ? result : null;
  const state = { data: current?.data ?? null, error: current?.error ?? null, loading: current === null };
  const w = state.data;
  return (
    <section className="border-t border-line px-4 py-3.5">
      <h3 className="text-[13px] font-medium text-ink">Weather here now</h3>
      {state.loading && (
        <div className="mt-2.5 flex items-end gap-4">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      )}
      {state.error && (
        <div className="mt-2">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}
      {w && (
        <>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="num text-2xl font-light text-ink">
              {w.temperatureC === null ? "—" : `${formatNumber(w.temperatureC, 1)}°C`}
            </span>
            <span className="text-ink-soft">{w.weatherCode !== null ? (WMO[w.weatherCode] ?? `Code ${w.weatherCode}`) : "—"}</span>
          </div>
          <dl className="num mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">Feels like</dt>
              <dd>{w.apparentC === null ? "—" : `${formatNumber(w.apparentC, 1)}°C`}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">Humidity</dt>
              <dd>{w.humidityPct === null ? "—" : `${formatNumber(w.humidityPct)}%`}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">Wind</dt>
              <dd>{w.windKmh === null ? "—" : `${formatNumber(w.windKmh)} km/h`}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">From</dt>
              <dd>{formatHeading(w.windDirDeg)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">Gusts</dt>
              <dd>{w.gustKmh === null ? "—" : `${formatNumber(w.gustKmh)} km/h`}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">Cloud</dt>
              <dd>{w.cloudCoverPct === null ? "—" : `${formatNumber(w.cloudCoverPct)}%`}</dd>
            </div>
          </dl>
          <p className="num mt-2.5 text-xs text-ink-faint">
            Modelled by Open-Meteo for {formatUtcShort(w.validAt)} UTC (not a station reading) · fetched{" "}
            {formatAge(w.retrievedAt)}
          </p>
        </>
      )}
    </section>
  );
}

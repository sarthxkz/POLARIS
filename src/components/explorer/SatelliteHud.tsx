"use client";

import { useClock } from "@/lib/client/usePolled";
import { formatLatLon } from "@/lib/geo";
import { formatNumber } from "@/lib/format";
import { estimate, orbitClass, type SatelliteTrack } from "@/lib/orbits";

/**
 * Live readout that rides beside the followed satellite: its SGP4 estimate, recomputed every
 * second. Positioned by the selection ring, so it follows the satellite across the screen.
 */
export function SatelliteHud({ track }: { track: SatelliteTrack }) {
  const now = useClock(1000);
  const s = now === null ? null : estimate(track, new Date(now));
  return (
    <div className="hud-in absolute top-1/2 left-[calc(100%+12px)] hidden w-[224px] -translate-y-1/2 group-data-[side=left]:right-[calc(100%+12px)] group-data-[side=left]:left-auto group-data-[side=left]:origin-right rounded-[10px] border border-line bg-surface/95 px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)] md:block">
      <p className="truncate text-[14px] font-medium text-ink">{track.name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
        <span className="size-1.5 rounded-full bg-cyan" aria-hidden />
        Following · SGP4 estimate
      </p>
      <dl className="num mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-ink-faint">Altitude</dt>
        <dd className="text-right text-ink">{s ? `${formatNumber(s.altitudeKm)} km` : "—"}</dd>
        <dt className="text-ink-faint">Speed</dt>
        <dd className="text-right text-ink">{s ? `${formatNumber(s.speedKms, 2)} km/s` : "—"}</dd>
        <dt className="text-ink-faint">Over</dt>
        <dd className="text-right text-ink">{s ? formatLatLon(s.lat, s.lon, 1) : "—"}</dd>
        <dt className="text-ink-faint">Orbit</dt>
        <dd className="text-right text-ink">{s ? orbitClass(s.altitudeKm) : "—"}</dd>
      </dl>
      <p className="mt-2.5 text-2xs text-ink-faint">Drag to orbit around it · Esc to return</p>
    </div>
  );
}

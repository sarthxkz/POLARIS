"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { useClock } from "@/lib/client/usePolled";
import { buildTrack, elementAgeHours, estimate, orbitClass } from "@/lib/orbits";
import { formatLatLon } from "@/lib/geo";
import { formatClock, formatNumber } from "@/lib/format";
import type { OrbitalElements } from "@/lib/types";

/**
 * The Satellites page's live fragment: one satellite's SGP4 estimate, recomputed every second in
 * this browser from the element set the server fetched from CelesTrak.
 */
export function LiveSatellite({ elements }: { elements: OrbitalElements & { group: string } }) {
  const track = useMemo(() => buildTrack(elements), [elements]);
  const tick = useClock(1000);
  const now = tick === null ? null : new Date(tick);

  const s = track && now ? estimate(track, now) : null;
  const age = now ? elementAgeHours(elements, now.getTime()) : null;

  const row = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4 px-2.5 py-2">
      <span className="text-[14px] text-ink-faint">{label}</span>
      <span className="num text-[15px] text-ink">{value}</span>
    </div>
  );

  return (
    <div className="rounded-[10px] border border-line bg-ground p-2">
      <div className="flex items-baseline justify-between px-2.5 pt-2 pb-2.5">
        <span className="text-[14px] font-medium text-ink">{elements.OBJECT_NAME}</span>
        <span className="num text-[13px] text-ink-faint">NORAD {elements.NORAD_CAT_ID}</span>
      </div>
      {row("Estimated at", now ? `${formatClock(now)} UTC` : "—")}
      {row("Over", s ? formatLatLon(s.lat, s.lon) : "—")}
      {row("Altitude", s ? `${formatNumber(s.altitudeKm)} km` : "—")}
      {row("Speed", s ? `${formatNumber(s.speedKms, 2)} km/s` : "—")}
      {row("Orbit", s ? orbitClass(s.altitudeKm) : "—")}
      {row("Elements age", age !== null ? `${formatNumber(age, 1)} h` : "—")}
      <Link
        href={`/?sat=${elements.NORAD_CAT_ID}`}
        className="mt-1 flex items-center gap-1.5 rounded-[6px] px-2.5 py-2.5 text-[14px] text-ink-soft transition-colors duration-150 hover:bg-hover hover:text-ink"
      >
        Follow it on the globe <ArrowRight aria-hidden size={14} strokeWidth={1.5} />
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import { snapshotDay, snapshotUrl } from "@/lib/gibs";
import { formatUtcDay } from "@/lib/format";
import { cx } from "./primitives";

/**
 * NASA's real true-colour satellite picture of an area on the observation day. The frame keeps
 * its final size while loading, so nothing shifts when the picture lands.
 */
export function SatelliteView({
  lat,
  lon,
  observedAt,
  spanDeg = 3,
  className,
  sizes = 640,
  marker = true,
}: {
  lat: number;
  lon: number;
  observedAt: string;
  spanDeg?: number;
  className?: string;
  sizes?: number;
  marker?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const { day, previousDay } = snapshotDay(observedAt);
  const src = snapshotUrl(lat, lon, day, spanDeg, sizes);

  return (
    <figure className={cx("m-0", className)}>
      <div className="relative aspect-square w-full overflow-hidden rounded-[6px] bg-raised outline outline-1 -outline-offset-1 outline-white/10">
        {state !== "failed" && (
          // eslint-disable-next-line @next/next/no-img-element -- remote NASA WMS image, sized by the frame
          <img
            src={src}
            alt={`True-colour satellite image of the area around ${lat.toFixed(2)}, ${lon.toFixed(2)} on ${day}`}
            width={sizes}
            height={sizes}
            loading="lazy"
            decoding="async"
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
            className={cx(
              "absolute inset-0 size-full object-cover transition-opacity duration-300",
              state === "ready" ? "opacity-100" : "opacity-0",
            )}
          />
        )}
        {state === "ready" && marker && (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-cyan"
          />
        )}
        {state === "failed" && (
          <p className="absolute inset-0 grid place-items-center p-4 text-center text-[13px] text-ink-faint">
            NASA has no true-colour image of this area for {formatUtcDay(day)} yet.
          </p>
        )}
      </div>
      <figcaption className="num mt-1.5 text-xs text-ink-faint">
        NASA VIIRS true colour, {formatUtcDay(day)}
        {previousDay ? " (previous day; today’s passes are still arriving)" : ""}. Night side and polar winter appear
        dark.
      </figcaption>
    </figure>
  );
}

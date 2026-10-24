import { useId } from "react";

/**
 * POLARIS mark: a tilted chrome orbit crossing a four-point star, on a dark rounded tile.
 * Redrawn as SVG from the user's reference image. The metallic sheen is part of the brand
 * mark and is used nowhere else in the interface.
 */
export function PolarisMark({ size = 32, tile = true, className }: { size?: number; tile?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="POLARIS"
      className={className}
    >
      <defs>
        <linearGradient id={`chrome-${id}`} x1="8" y1="44" x2="56" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6f7782" />
          <stop offset="0.35" stopColor="#f4f7fa" />
          <stop offset="0.55" stopColor="#9aa3ad" />
          <stop offset="0.8" stopColor="#ffffff" />
          <stop offset="1" stopColor="#7d8590" />
        </linearGradient>
        <radialGradient id={`tile-${id}`} cx="0.3" cy="0.2" r="1">
          <stop offset="0" stopColor="#1a1d22" />
          <stop offset="1" stopColor="#07080a" />
        </radialGradient>
      </defs>
      {tile && <rect x="1" y="1" width="62" height="62" rx="14" fill={`url(#tile-${id})`} stroke="#262a31" strokeWidth="1" />}
      {/* Orbit: a thin ellipse tilted about 28°, thicker on its near (lower-left) side. */}
      <g transform="rotate(-28 32 32)">
        <ellipse cx="32" cy="32" rx="22" ry="6.4" fill="none" stroke={`url(#chrome-${id})`} strokeWidth="2.2" />
        <ellipse cx="32" cy="33.2" rx="21" ry="5" fill="none" stroke={`url(#chrome-${id})`} strokeWidth="0.9" opacity="0.55" />
      </g>
      {/* Four-point star where the orbit crosses its right side. */}
      <path
        d="M44.5 17.5 C45.2 22.6 46.4 23.8 51.5 24.5 C46.4 25.2 45.2 26.4 44.5 31.5 C43.8 26.4 42.6 25.2 37.5 24.5 C42.6 23.8 43.8 22.6 44.5 17.5 Z"
        fill={`url(#chrome-${id})`}
      />
      <circle cx="44.5" cy="24.5" r="1.1" fill="#ffffff" />
    </svg>
  );
}

import { GLYPHS } from "./glyphs";
import { CATEGORY_COLOR, DATA, quakeColor, quakeSize } from "@/lib/palette";
import type { EventCategory } from "@/lib/types";

/*
 * Marker images for Cesium billboards, built once as SVG data URLs and cached. Billboards share
 * a texture atlas, so a few dozen distinct images serve thousands of markers.
 */

const cache = new Map<string, string>();
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const GROUND = "#04070c";

function memo(key: string, build: () => string) {
  let url = cache.get(key);
  if (!url) {
    url = build();
    cache.set(key, url);
  }
  return url;
}

/** A dark disc with a 1.5px ring and the category's glyph, so markers read on bright imagery. */
export function eventMarker(category: Exclude<EventCategory, "earthquakes">, state: "default" | "closed" = "default") {
  return memo(`event:${category}:${state}`, () => {
    const color = CATEGORY_COLOR[category];
    const glyph = GLYPHS[category as keyof typeof GLYPHS] ?? "";
    const opacity = state === "closed" ? 0.55 : 1;
    return svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">` +
        `<circle cx="22" cy="22" r="19" fill="${GROUND}" fill-opacity="0.82" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2.5"/>` +
        `<g transform="translate(11 11) scale(0.9166)" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>` +
        `</svg>`,
    );
  });
}

/** Earthquakes follow seismology convention: a filled circle sized by magnitude. */
export function quakeMarker(magnitude: number | null) {
  const size = quakeSize(magnitude);
  const color = quakeColor(magnitude);
  return memo(`quake:${size}:${color}`, () => {
    const s = size * 2;
    const r = s / 2 - 2;
    return svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">` +
        `<circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="${color}" fill-opacity="0.38" stroke="${color}" stroke-width="2.5"/>` +
        `</svg>`,
    );
  });
}

/** Aircraft silhouette pointing north; the billboard rotates it to the reported track. */
export function aircraftMarker(variant: "air" | "selected") {
  return memo(`aircraft:${variant}`, () => {
    const color = variant === "selected" ? DATA.selected : DATA.aircraft;
    return svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">` +
        `<path d="M12 2.2c.7 0 1.2.9 1.2 2.1v5.2l7.6 4.4v2l-7.6-2.3v4.8l2.2 1.7v1.6L12 21l-3.4.9v-1.6l2.2-1.7v-4.8l-7.6 2.3v-2l7.6-4.4V4.3c0-1.2.5-2.1 1.2-2.1z" fill="${color}" stroke="${GROUND}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `</svg>`,
    );
  });
}

export function eventImage(category: EventCategory, magnitude: number | null, closed: boolean) {
  if (category === "earthquakes") return { image: quakeMarker(magnitude), size: quakeSize(magnitude) };
  return { image: eventMarker(category, closed ? "closed" : "default"), size: 22 };
}

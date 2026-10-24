import "server-only";
import { fetchProvider } from "../http";

const BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** Time-varying GIBS layers whose newest available time we report to visitors. */
export const TIMED_LAYERS = {
  VIIRS_SNPP_CorrectedReflectance_TrueColor: { tms: "GoogleMapsCompatible_Level9", ext: "jpg" },
  "GOES-East_ABI_Band13_Clean_Infrared": { tms: "GoogleMapsCompatible_Level6", ext: "png" },
  "GOES-West_ABI_Band13_Clean_Infrared": { tms: "GoogleMapsCompatible_Level6", ext: "png" },
  Himawari_AHI_Band13_Clean_Infrared: { tms: "GoogleMapsCompatible_Level6", ext: "png" },
  IMERG_Precipitation_Rate_30min: { tms: "GoogleMapsCompatible_Level6", ext: "png" },
} as const;

export type TimedLayer = keyof typeof TIMED_LAYERS;

/**
 * Asks GIBS for one small tile at the layer's default (newest) time and reads which time it
 * actually served from the `Layer-Time-Actual` header. The browser then requests that exact
 * time, which is cacheable, and the interface can say precisely how old the picture is.
 */
async function latestTime(layer: TimedLayer): Promise<string | null> {
  const { tms, ext } = TIMED_LAYERS[layer];
  const response = await fetchProvider(`${BASE}/${layer}/default/default/${tms}/0/0/0.${ext}`, {
    timeoutMs: 15_000,
    retries: 1,
    headers: { Accept: "image/*" },
  });
  const actual = response.headers.get("layer-time-actual");
  await response.body?.cancel();
  return actual ? new Date(actual).toISOString() : null;
}

export async function loadGibsTimes(): Promise<Record<string, string | null>> {
  const layers = Object.keys(TIMED_LAYERS) as TimedLayer[];
  const settled = await Promise.allSettled(layers.map(latestTime));
  if (settled.every((r) => r.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  return Object.fromEntries(
    layers.map((layer, i) => {
      const r = settled[i]!;
      return [layer, r.status === "fulfilled" ? r.value : null];
    }),
  );
}

// Runs once when the Next.js server starts. Warms the provider caches so the first visitor
// does not wait on slow upstreams (EONET's open-events query can take ~20 seconds).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { eonet, usgs, usgsOlder, celestrak, gibs, opensky } = await import("./server/sources");
  for (const collector of [eonet, usgs, usgsOlder, celestrak, gibs, opensky]) {
    void collector.get().catch(() => {});
  }
}

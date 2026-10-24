// Compacts Natural Earth GeoJSON (public domain, naturalearthdata.com) into the small files the
// globe loads from /data. Usage: node scripts/build-natural-earth.mjs <dir-with-source-geojson>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src) throw new Error("Pass the directory holding the Natural Earth .geojson files");
const read = (name) => JSON.parse(readFileSync(join(src, `${name}.geojson`), "utf8"));
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
mkdirSync("public/data", { recursive: true });

// 1. Land boundaries between countries, as flat [lon, lat, lon, lat, ...] arrays.
const lines = [];
for (const f of read("ne_50m_admin_0_boundary_lines_land").features) {
  const g = f.geometry;
  const parts = g.type === "LineString" ? [g.coordinates] : g.coordinates;
  for (const part of parts) lines.push(part.flatMap(([x, y]) => [r(x, 3), r(y, 3)]));
}
writeFileSync("public/data/borders.json", JSON.stringify(lines));

// 2. Countries: name, ISO code, label point, label rank and a simplified outline for lookups.
const countries = read("ne_110m_admin_0_countries").features.map((f) => {
  const p = f.properties;
  const g = f.geometry;
  const polygons = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((poly) =>
    poly.map((ring) => ring.flatMap(([x, y]) => [r(x, 2), r(y, 2)])),
  );
  const xs = polygons.flat(2).filter((_, i) => i % 2 === 0);
  const ys = polygons.flat(2).filter((_, i) => i % 2 === 1);
  return {
    name: p.NAME,
    iso: p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ADM0_A3,
    lon: r(p.LABEL_X, 3),
    lat: r(p.LABEL_Y, 3),
    rank: p.LABELRANK,
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    polygons,
  };
});
writeFileSync("public/data/countries.json", JSON.stringify(countries));

// 3. Major cities for place labels.
const cities = read("ne_110m_populated_places_simple").features.map((f) => {
  const p = f.properties;
  return { name: p.name, country: p.adm0name, lon: r(p.longitude, 3), lat: r(p.latitude, 3), rank: p.scalerank, pop: p.pop_max };
});
writeFileSync("public/data/cities.json", JSON.stringify(cities));

console.log(`borders ${lines.length} lines, countries ${countries.length}, cities ${cities.length}`);

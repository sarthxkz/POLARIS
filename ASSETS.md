# Asset provenance

| Path | What it is | Origin |
| --- | --- | --- |
| `public/icon.svg`, `src/components/brand/PolarisMark.tsx` | POLARIS mark (orbit ring and four-point star) | Hand-drawn SVG, redrawn from the logo reference image the project owner supplied. Replace with the original file if one is provided. |
| `public/cesium/**` | CesiumJS runtime assets (web workers, star-map skybox, credits, textures) | Copied from the `cesium` npm package (Apache-2.0) by `scripts/copy-cesium-assets.mjs` on install, dev and build. Generated, not committed. |
| `public/data/*.json` | Country borders, country and city names and outlines | Natural Earth (public domain), compacted by `scripts/build-natural-earth.mjs`. See `public/data/SOURCES.md`. |
| `src/components/globe/glyphs.ts` | Globe marker glyphs | Lucide icons (ISC), extracted by `scripts/gen-marker-glyphs.mjs`. |
| Globe imagery, event pictures | Blue Marble, VIIRS Black Marble, VIIRS true colour, GOES/Himawari infrared, IMERG precipitation | NASA GIBS, loaded live from `gibs.earthdata.nasa.gov`; nothing is stored in the repository. |

No generated (AI) images ship in this project.

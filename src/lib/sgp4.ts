// satellite.js's package entry also loads its optional WebAssembly runtimes, which import Node
// built-ins (node:module, node:worker_threads) and cannot be bundled for the browser. Its
// exports map only exposes that entry, so the pure-JS SGP4 modules are imported by file path.
export { json2satrec } from "../../node_modules/satellite.js/dist/io.js";
export { gstime, propagate } from "../../node_modules/satellite.js/dist/propagation.js";
export { eciToEcf, eciToGeodetic } from "../../node_modules/satellite.js/dist/transforms.js";
export type { SatRec } from "../../node_modules/satellite.js/dist/propagation/SatRec.js";

// Must be imported before any Cesium module is evaluated: tells Cesium where its workers and
// static assets are served from (copied into public/cesium by scripts/copy-cesium-assets.mjs).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/";
export {};

// Copies CesiumJS static runtime assets (web workers, textures, third-party wasm)
// into public/cesium so the browser can load them from our own origin.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "cesium", "Build", "Cesium");
const target = join(root, "public", "cesium");

if (!existsSync(source)) {
  console.warn("[cesium] package not installed yet; skipping asset copy");
  process.exit(0);
}

if (process.argv.includes("--if-missing") && existsSync(join(target, "Workers"))) process.exit(0);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const dir of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(join(source, dir), join(target, dir), { recursive: true });
}
console.log("[cesium] copied runtime assets to public/cesium");

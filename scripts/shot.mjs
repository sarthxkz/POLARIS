// Captures screenshots of a page at given viewport sizes and reports console errors.
// Usage: node scripts/shot.mjs <url> <out-prefix> [waitMs] [w x h ...]
import { chromium } from "@playwright/test";

const [url, prefix, wait = "12000", ...sizes] = process.argv.slice(2);
const viewports = (sizes.length ? sizes : ["1440x900", "390x844"]).map((s) => s.split("x").map(Number));

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const [width, height] of viewports) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(Number(wait));
  const out = `${prefix}-${width}.png`;
  await page.screenshot({ path: out });
  console.log(`saved ${out}`);
  if (errors.length) console.log(`console errors (${errors.length}):\n  ` + errors.slice(0, 8).join("\n  "));
  await page.close();
}
await browser.close();

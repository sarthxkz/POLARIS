import { chromium } from "@playwright/test";
const [url, out, w, h, y] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, reducedMotion: "reduce" });
await p.goto(url, { waitUntil: "networkidle" });
await p.evaluate((y) => window.scrollTo(0, y), +y);
await p.waitForTimeout(800);
await p.screenshot({ path: out });
await b.close();

// Full-page screenshots of read pages at desktop and phone widths, motion settled.
import { chromium } from "@playwright/test";
const [base, out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  for (const p of paths) {
    const errors = [];
    page.removeAllListeners("pageerror");
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const file = `${out}/page${p.replace(/\//g, "-") || "-home"}-${w}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file, errors.length ? `errors: ${errors.join(" | ")}` : "");
  }
  await page.close();
}
await browser.close();

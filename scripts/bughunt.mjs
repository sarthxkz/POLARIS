// Drives the globe through its main paths and reports every console error, page error and
// failed request, with screenshots of each state. Usage: node scripts/bughunt.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3001";
const out = process.argv[3] ?? ".impeccable/review";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const problems = [];

async function session(name, viewport, steps) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`[${name}] console.${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${name}] pageerror: ${String(e).slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`[${name}] HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  page.on("requestfailed", (r) => problems.push(`[${name}] request failed: ${r.url().slice(0, 160)} ${r.failure()?.errorText}`));
  await steps(page);
  await page.close();
}

const shot = (page, file) => page.screenshot({ path: `${out}/${file}.png` });

await session("desktop", { width: 1440, height: 900 }, async (page) => {
  await page.goto(base + "/");
  await page.waitForTimeout(3500);
  await shot(page, "r1-arrival");
  await page.waitForTimeout(14000);
  await shot(page, "r2-rest-rotating");

  // Layers open and close.
  await page.getByRole("button", { name: "Layers" }).click();
  await page.waitForTimeout(600);
  await shot(page, "r3-layers-open");
  await page.getByRole("button", { name: "Hide the layer list" }).click();

  // Follow the ISS via search.
  const search = page.getByRole("combobox");
  await search.click();
  await search.fill("ISS");
  await page.waitForTimeout(1200);
  await page.getByRole("option").filter({ hasText: "ISS (ZARYA)" }).first().click();
  await page.waitForTimeout(5000);
  await shot(page, "r4-follow-iss");
  await page.waitForTimeout(4000);
  await shot(page, "r5-follow-iss-later");

  // Back out, then open an event from the list.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2600);
  await shot(page, "r6-back-out");
  await page.getByRole("button", { name: /^Events \d/ }).click();
  await page.locator('aside[aria-label="Event feed"] ol button').first().click();
  await page.waitForTimeout(3500);
  await shot(page, "r7-event");

  // Click a satellite directly on the globe after returning home.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Stop turning the globe" }).click();
  await page.waitForTimeout(500);
});

await session("phone", { width: 390, height: 844 }, async (page) => {
  await page.goto(base + "/");
  await page.waitForTimeout(16000);
  await shot(page, "r8-phone");
});

await session("deeplink", { width: 1440, height: 900 }, async (page) => {
  await page.goto(base + "/?sat=25544");
  await page.waitForTimeout(12000);
  await shot(page, "r9-deeplink-sat");
});

console.log(problems.length ? problems.join("\n") : "no problems recorded");
await browser.close();

// Drives the explorer through its main interactions and captures each state.
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000/";
const out = process.argv[3] ?? ".impeccable/review";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(base);
await page.getByRole("heading", { name: /^Events/ }).first().waitFor({ timeout: 60000 });
await page.waitForTimeout(14000);
await page.screenshot({ path: `${out}/i1-home.png` });

// 1. Select the first event in the feed.
await page.locator('aside[aria-label="Event feed"] ol button').first().click();
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/i2-event.png` });

// 2. Search for the ISS and pick it.
await page.keyboard.press("Escape");
const search = page.getByRole("combobox");
await search.click();
await search.fill("ISS");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/i3-search.png` });
await page.getByRole("option").filter({ hasText: "ISS (ZARYA)" }).first().click();
await page.waitForTimeout(4500);
await page.screenshot({ path: `${out}/i4-satellite.png` });

// 3. Clear, then click open ground in the middle of the globe.
await page.keyboard.press("Escape");
await page.waitForTimeout(2500);
await page.mouse.click(700, 450);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/i5-ground.png` });

console.log(errors.length ? `errors:\n  ${errors.slice(0, 10).join("\n  ")}` : "no console errors");
await browser.close();

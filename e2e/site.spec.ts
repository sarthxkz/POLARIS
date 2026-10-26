import { expect, test } from "@playwright/test";

test.describe("API", () => {
  test("health separates the server from its feeds", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.server).toBe("ok");
    expect(body.feeds.total).toBe(6);
  });

  test("events validate their query and carry sources", async ({ request }) => {
    expect((await request.get("/api/events?bbox=nonsense")).status()).toBe(400);
    expect((await request.get("/api/events?days=999")).status()).toBe(400);
    const res = await request.get("/api/events?days=7&limit=5");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    for (const e of body.events) {
      expect(e.links.length).toBeGreaterThan(0);
      expect(Date.parse(e.observedAt)).not.toBeNaN();
    }
  });

  test("search parses coordinates without calling a provider", async ({ request }) => {
    const res = await request.get("/api/search?q=18.52,%2073.85");
    const body = await res.json();
    expect(body.results[0].kind).toBe("coordinates");
  });

  test("weather and aircraft track reject bad input", async ({ request }) => {
    expect((await request.get("/api/weather?lat=200&lon=0")).status()).toBe(400);
    expect((await request.get("/api/aircraft/track?icao24=../etc")).status()).toBe(400);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});

test.describe("Pages", () => {
  for (const [path, heading] of [
    ["/events", "What the planet did"],
    ["/satellites", "Satellites overhead"],
    ["/sources", "Where every number"],
    ["/about", "Navigate the"],
  ] as const) {
    test(`${path} renders its headline and no horizontal scroll`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      expect(errors).toEqual([]);
    });
  }

  test("globe page loads the feed and opens an event", async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    // The event list rests folded on desktop; open it from its chip.
    const chip = page.getByRole("button", { name: /^Events \d/ });
    if (await chip.isVisible()) await chip.click();
    await expect(page.getByRole("heading", { name: /^Events/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    const first = page.locator("ol button").filter({ visible: true }).first();
    await first.click();
    await expect(page.getByRole("button", { name: isMobile ? "Back" : "Event list" })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
});

import { expect, test } from "@playwright/test";

test("skip link moves focus past the header", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard path");
  await page.goto("/about");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("read pages: sticky header gains a background and back-to-top returns", async ({ page }) => {
  await page.goto("/sources");
  // Hidden from assistive tech until it appears, so find it by attribute rather than role.
  const top = page.locator('button[aria-label="Back to top"]');
  await expect(top).toHaveCSS("opacity", "0");
  await page.mouse.wheel(0, 3000);
  await expect(page.locator("html")).toHaveAttribute("data-scrolled", "");
  await expect(top).toHaveCSS("opacity", "1");
  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
});

test("FAQ answers open and close", async ({ page }) => {
  await page.goto("/about");
  const q = page.getByText("Are the satellite positions live?");
  const answer = page.getByText(/They are estimates/);
  await expect(answer).toBeHidden();
  await q.click();
  await expect(answer).toBeVisible();
  await q.click();
  await expect(answer).toBeHidden();
});

test("phone: the globe page has a site menu", async ({ page, isMobile }) => {
  test.skip(!isMobile, "menu replaces the nav below lg");
  await page.goto("/");
  await page.getByRole("button", { name: "Site menu" }).click();
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Sources" }).click();
  await expect(page).toHaveURL(/\/sources$/);
});

test("copy link reopens the same satellite", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "clipboard permission is desktop-only in this setup");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?sat=25544");
  await page.getByRole("button", { name: "Copy link" }).click({ timeout: 60_000 });
  await expect(page.getByText("Copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).search).toBe("?sat=25544");
});

// Regression: leaving the globe used to crash (Cesium double-destroyed a shared material).
for (const [name, heading] of [
  ["About", "Navigate the"],
  ["Events", "What the planet did"],
  ["Sources", "Where every number"],
  ["Satellites", "Satellites overhead"],
] as const) {
  test(`navigating from the globe to ${name} works`, async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop nav links");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Let the globe mount and load its layers before leaving, as a visitor would.
    await expect(page.getByRole("button", { name: /^Events \d/ })).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(3000);
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

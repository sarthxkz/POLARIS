import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WCAG 2.1 AA automated checks. The Cesium canvas is excluded: it is a WebGL drawing surface
// whose content is mirrored in the keyboard-accessible event feed and detail panels.
for (const path of ["/", "/events", "/satellites", "/sources", "/about"]) {
  test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
    // Settle entrance motion first: mid-fade text has partial opacity and fails contrast falsely.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForTimeout(1000);
    if (path === "/") {
      // The event list rests folded on desktop; open it from its chip.
      const chip = page.getByRole("button", { name: /^Events \d/ });
      if (await chip.isVisible()) await chip.click();
      await expect(page.getByRole("heading", { name: /^Events/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".cesium-widget")
      .analyze();
    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
    );
    expect(summary).toEqual([]);
  });
}

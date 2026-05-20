import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers";

// Skipped by default: requires headed Chromium with extension loading.
test.skip(
  !!process.env.CI || !process.env.PTC_E2E,
  "Requires headed Chromium with extension loading (set PTC_E2E=1 to run)"
);

test("options page persists selection", async () => {
  const ctx = await launchWithExtension();
  // The extension id is dynamic; resolve via the background service worker URL.
  const sw =
    ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const url = sw.url().replace(/background\/index\.js$/, "options/options.html");
  const page = await ctx.newPage();
  await page.goto(url);
  await page.check('input[name="imageQuality"][value="original"]');
  await page.reload();
  await expect(
    page.locator('input[name="imageQuality"][value="original"]')
  ).toBeChecked();
  await ctx.close();
});

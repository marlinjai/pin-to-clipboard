import { test, expect } from "@playwright/test";
import { launchWithExtension, servePinterestFixture } from "./helpers";

// Skipped by default: requires headed Chromium with extension loading,
// which is not available in this sandboxed/CI environment. Run locally
// with `npm run e2e` once Playwright's Chromium is installed.
test.skip(
  !!process.env.CI || !process.env.PTC_E2E,
  "Requires headed Chromium with extension loading (set PTC_E2E=1 to run)"
);

test("button appears on grid cards and writes to clipboard", async () => {
  const ctx = await launchWithExtension();
  // Intercept i.pinimg.com to serve a minimal JPEG body.
  await ctx.route("https://i.pinimg.com/**/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    })
  );
  const url = await servePinterestFixture(ctx, "board.html");
  const page = await ctx.newPage();
  await page.goto(url);
  await page.hover("[data-test-id=pin][data-pin-id='111']");
  await page.click(
    "[data-test-id=pin][data-pin-id='111'] button[data-ptc=copy]"
  );
  await page.waitForSelector("[data-ptc-toast=ok]");
  const count = await page.evaluate(() =>
    navigator.clipboard.read().then((items) => items.length)
  );
  expect(count).toBeGreaterThan(0);
  await ctx.close();
});

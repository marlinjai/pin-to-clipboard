import { test, expect } from "@playwright/test";
import { launchWithExtension, servePinterestFixture } from "./helpers";

// Skipped by default: requires headed Chromium with extension loading.
test.skip(
  !!process.env.CI || !process.env.PTC_E2E,
  "Requires headed Chromium with extension loading (set PTC_E2E=1 to run)"
);

test("pushState route change re-injects buttons", async () => {
  const ctx = await launchWithExtension();
  const url = await servePinterestFixture(ctx, "board.html");
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector("button[data-ptc=copy]");
  await page.evaluate(() => {
    document.body.innerHTML = "<div></div>";
    history.pushState({}, "", "?route=2");
    document.body.innerHTML = `<div data-test-id="pin" data-pin-id="999"><img src="https://i.pinimg.com/236x/a/b/c/d.jpg"></div>`;
  });
  await page.waitForSelector("[data-pin-id='999'] button[data-ptc=copy]");
  expect(true).toBe(true);
  await ctx.close();
});

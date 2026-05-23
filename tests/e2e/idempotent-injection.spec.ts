import { test, expect } from "@playwright/test";
import { launchWithExtension, servePinterestFixture } from "./helpers";

// Skipped by default: requires headed Chromium with extension loading.
test.skip(
  !!process.env.CI || !process.env.PTC_E2E,
  "Requires headed Chromium with extension loading (set PTC_E2E=1 to run)"
);

test("re-running scan does not double-inject buttons", async () => {
  const ctx = await launchWithExtension();
  const url = await servePinterestFixture(ctx, "board.html");
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector("button[data-ptc=copy]");
  await page.evaluate(() => {
    const first = document.body.firstElementChild;
    if (first) document.body.appendChild(first.cloneNode(true));
  });
  await page.waitForTimeout(300);
  const counts = await page.$$eval("[data-test-id=pin]", (cards) =>
    cards.map((c) => c.querySelectorAll("button[data-ptc=copy]").length)
  );
  for (const n of counts) expect(n).toBeLessThanOrEqual(1);
  await ctx.close();
});

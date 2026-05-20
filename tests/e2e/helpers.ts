import { chromium, BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Launch a persistent Chromium context with the built extension loaded.
 * The extension's manifest only matches *://*.pinterest.com/*, so e2e
 * tests must serve fixtures from a pinterest.com URL via ctx.route().
 */
export async function launchWithExtension(): Promise<BrowserContext> {
  const ext = path.resolve("dist");
  return chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      "--no-first-run",
    ],
    permissions: ["clipboard-read", "clipboard-write"],
  });
}

/**
 * Read a fixture file and register a ctx.route handler that fulfills the
 * given pinterest.com URL with that HTML. Returns the URL to navigate to.
 *
 * This is required because the content script's manifest match only fires
 * on pinterest.com hostnames; file:// fixtures would never trigger it.
 */
export async function servePinterestFixture(
  ctx: BrowserContext,
  file: string,
  urlPath = "/board/"
): Promise<string> {
  const body = readFileSync(path.resolve("tests/fixtures", file), "utf8");
  const url = `https://www.pinterest.com${urlPath}`;
  await ctx.route(url, (route) =>
    route.fulfill({ contentType: "text/html", body })
  );
  // Also intercept any sub-path of the same urlPath (e.g. for pushState routes).
  await ctx.route(`https://www.pinterest.com${urlPath}**`, (route) =>
    route.fulfill({ contentType: "text/html", body })
  );
  return url;
}

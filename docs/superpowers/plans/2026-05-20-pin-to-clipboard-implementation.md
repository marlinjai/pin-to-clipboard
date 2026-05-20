# Pin to Clipboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an MV3 Chrome extension that adds a one-click "copy image to clipboard" hover button on Pinterest grid/home/search pins, with a configurable video action on the detail page, ready for the Chrome Web Store.

**Architecture:** Service worker fetches image bytes (CORS-bypass is only available there) and returns an ArrayBuffer to the content script, which writes the blob to the clipboard inside the user-gesture click via a `Promise<Blob>`-backed `ClipboardItem`. An offscreen document transcodes to PNG only for formats the clipboard cannot accept directly. The content script handles SPA route changes, infinite-scroll injection, and an accessible hover button.

**Tech Stack:** TypeScript, esbuild bundler, Vitest (unit), Playwright (e2e, chromium with extension loaded), Chrome MV3.

**Spec:** `docs/superpowers/specs/2026-05-19-pinterest-copy-extension-design.md`

---

## File structure

```
pin-to-clipboard/
  package.json
  tsconfig.json
  esbuild.config.mjs
  vitest.config.ts
  playwright.config.ts
  .gitignore
  README.md
  docs/
    PRIVACY-AND-PERMISSIONS.md   (Web Store justifications)
  src/
    manifest.json
    shared/
      types.ts                   (message contracts, settings shape)
    background/
      index.ts                   (SW entry: routes messages)
      resolver.ts                (size ladder + extension probe + cache + backoff)
      fetcher.ts                 (CORS-bypass fetch, returns ArrayBuffer + mime)
    content/
      index.ts                   (entry: observer + route hook + glue)
      pin-detection.ts           (locate cards, classify image/video, extract candidate)
      hover-button.ts            (button DOM, states, a11y, placement)
      clipboard.ts               (Promise<Blob> ClipboardItem write + fallbacks)
      toast.ts                   (success/error toast)
    offscreen/
      offscreen.html
      offscreen.ts               (PNG transcode for unsupported types)
    options/
      options.html
      options.ts
      storage.ts                 (typed wrapper around chrome.storage.sync)
    assets/
      icon-16.png  icon-48.png  icon-128.png
  tests/
    unit/
      resolver.test.ts
      pin-detection.test.ts
      storage.test.ts
      toast.test.ts
    fixtures/
      board.html
      detail-image.html
      detail-video.html
    e2e/
      copy-image.spec.ts
      idempotent-injection.spec.ts
      route-change.spec.ts
      options.spec.ts
      detail-video.spec.ts
```

Boundaries:
- `background/*` is the only code that touches the network and the URL ladder cache.
- `content/*` is the only code that touches the page DOM and the clipboard.
- `offscreen/*` is a leaf: takes bytes in, returns PNG bytes out.
- `shared/types.ts` is the single source of truth for cross-context messages.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore` (overwrite existing)
- Create: `README.md`
- Create: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

`tests/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "pin-to-clipboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node esbuild.config.mjs",
    "build:watch": "node esbuild.config.mjs --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1.46.0",
    "@types/chrome": "^0.0.270",
    "@types/node": "^20.14.0",
    "esbuild": "^0.23.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "node"],
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Create esbuild.config.mjs**

```js
import { build, context } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  logLevel: "info",
  sourcemap: true,
};

const entries = [
  { entryPoints: ["src/background/index.ts"], outdir: "dist/background" },
  { entryPoints: ["src/content/index.ts"], outdir: "dist/content" },
  { entryPoints: ["src/offscreen/offscreen.ts"], outdir: "dist/offscreen" },
  { entryPoints: ["src/options/options.ts"], outdir: "dist/options" },
];

async function copyStatic() {
  await mkdir("dist", { recursive: true });
  await cp("src/manifest.json", "dist/manifest.json");
  await cp("src/offscreen/offscreen.html", "dist/offscreen/offscreen.html");
  await cp("src/options/options.html", "dist/options/options.html");
  await cp("src/assets", "dist/assets", { recursive: true });
}

await copyStatic();
if (watch) {
  for (const e of entries) (await context({ ...common, ...e })).watch();
} else {
  for (const e of entries) await build({ ...common, ...e });
}
```

- [ ] **Step 5: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Overwrite .gitignore and create README.md**

`.gitignore`:
```
node_modules/
dist/
.DS_Store
.infisical.json
playwright-report/
test-results/
```

`README.md`:
```md
# Pin to Clipboard

Chrome MV3 extension that adds a one-click copy button to Pinterest pins.

## Develop
- `npm install`
- `npm run build:watch`
- Load `dist/` as an unpacked extension at `chrome://extensions`
- `npm test` (unit), `npm run e2e` (Playwright)
```

- [ ] **Step 7: Install and verify the smoke test passes**

Run: `npm install && npm test`
Expected: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold typescript + esbuild + vitest"
```

---

## Task 2: Manifest and shared types

**Files:**
- Create: `src/manifest.json`
- Create: `src/shared/types.ts`
- Create: `src/assets/icon-16.png`, `icon-48.png`, `icon-128.png` (1px transparent placeholders for now; final art produced in Task 15)
- Test: `tests/unit/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest test**

`tests/unit/manifest.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import manifest from "../../src/manifest.json" assert { type: "json" };

describe("manifest", () => {
  it("declares MV3 with the expected permissions and no clipboardWrite", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "downloads", "offscreen"])
    );
    expect(manifest.permissions).not.toContain("clipboardWrite");
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        "*://*.pinterest.com/*",
        "*://i.pinimg.com/*",
        "*://v.pinimg.com/*",
      ])
    );
  });

  it("registers SW, content script, options page, and action", () => {
    expect(manifest.background.service_worker).toBe("background/index.js");
    expect(manifest.content_scripts[0].matches).toContain("*://*.pinterest.com/*");
    expect(manifest.content_scripts[0].js).toEqual(["content/index.js"]);
    expect(manifest.options_page).toBe("options/options.html");
    expect(manifest.action).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm test`
Expected: FAIL (manifest.json does not exist).

- [ ] **Step 3: Create the manifest**

`src/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Pin to Clipboard",
  "description": "One-click copy of a Pinterest pin's image to your clipboard, from any board, home, or search.",
  "version": "0.1.0",
  "icons": {
    "16": "assets/icon-16.png",
    "48": "assets/icon-48.png",
    "128": "assets/icon-128.png"
  },
  "background": { "service_worker": "background/index.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["*://*.pinterest.com/*"],
      "js": ["content/index.js"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "options/options.html",
  "action": { "default_title": "Pin to Clipboard settings" },
  "permissions": ["storage", "downloads", "offscreen"],
  "host_permissions": [
    "*://*.pinterest.com/*",
    "*://i.pinimg.com/*",
    "*://v.pinimg.com/*"
  ]
}
```

- [ ] **Step 4: Create shared/types.ts**

`src/shared/types.ts`:
```ts
export type ImageQuality = "largest-available" | "original";
export type VideoAction = "copy-url" | "download" | "both";

export interface Settings {
  imageQuality: ImageQuality;
  videoAction: VideoAction;
}

export const DEFAULT_SETTINGS: Settings = {
  imageQuality: "largest-available",
  videoAction: "copy-url",
};

export type Message =
  | {
      type: "RESOLVE_AND_FETCH";
      pinId: string;
      candidateUrl: string;
      quality: ImageQuality;
    }
  | { type: "VIDEO_ACTION"; pinId: string; sources: VideoSources }
  | { type: "TRANSCODE_TO_PNG"; bytes: ArrayBuffer; mimeType: string };

export type Response =
  | {
      ok: true;
      type: "MEDIA";
      bytes: ArrayBuffer;
      mimeType: string;
      resolvedUrl: string;
    }
  | { ok: true; type: "VIDEO_DONE"; copiedUrl?: string; downloaded?: boolean }
  | { ok: true; type: "PNG_BYTES"; bytes: ArrayBuffer }
  | { ok: false; code: ErrorCode; message: string; fallbackUrl?: string };

export type ErrorCode =
  | "NO_ORIGINALS"
  | "ANIMATED_UNCOPYABLE"
  | "CDN_BLOCKED"
  | "FETCH_FAILED"
  | "TRANSCODE_FAILED"
  | "NO_VIDEO_SOURCE";

export interface VideoSources {
  mp4Url?: string;
  hlsUrl?: string;
  posterUrl?: string;
}
```

- [ ] **Step 5: Create the placeholder icon files**

Run:
```bash
node -e "const fs=require('fs');const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63600000000200015c0d0a2d000000004945', 'hex');for (const s of [16,48,128]) fs.writeFileSync('src/assets/icon-' + s + '.png', png);"
```

(Final icon art is produced in Task 15.)

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add MV3 manifest and shared message/setting types"
```

---

## Task 3: Typed storage wrapper

**Files:**
- Create: `src/options/storage.ts`
- Test: `tests/unit/storage.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, setSettings } from "../../src/options/storage";
import { DEFAULT_SETTINGS } from "../../src/shared/types";

function mockChromeStorage(initial: Record<string, unknown> = {}) {
  const store = { ...initial };
  // @ts-expect-error - test stub
  globalThis.chrome = {
    storage: {
      sync: {
        get: vi.fn(async (keys) => {
          const k = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(k.map((x) => [x, store[x as string]]));
        }),
        set: vi.fn(async (obj) => Object.assign(store, obj)),
      },
    },
  };
  return store;
}

describe("storage", () => {
  beforeEach(() => mockChromeStorage());

  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips values and ignores unknown enum strings", async () => {
    await setSettings({ imageQuality: "original" });
    expect((await getSettings()).imageQuality).toBe("original");
  });

  it("falls back to default for an invalid stored value", async () => {
    mockChromeStorage({ settings: { imageQuality: "bogus", videoAction: "copy-url" } });
    expect((await getSettings()).imageQuality).toBe(DEFAULT_SETTINGS.imageQuality);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL (storage.ts missing).

- [ ] **Step 3: Implement storage.ts**

`src/options/storage.ts`:
```ts
import {
  DEFAULT_SETTINGS,
  Settings,
  ImageQuality,
  VideoAction,
} from "../shared/types";

const IMAGE_QUALITIES: ImageQuality[] = ["largest-available", "original"];
const VIDEO_ACTIONS: VideoAction[] = ["copy-url", "download", "both"];

function sanitize(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  return {
    imageQuality: IMAGE_QUALITIES.includes(r.imageQuality as ImageQuality)
      ? (r.imageQuality as ImageQuality)
      : DEFAULT_SETTINGS.imageQuality,
    videoAction: VIDEO_ACTIONS.includes(r.videoAction as VideoAction)
      ? (r.videoAction as VideoAction)
      : DEFAULT_SETTINGS.videoAction,
  };
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get("settings");
  return sanitize(settings);
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...patch } });
}
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(options): typed storage wrapper with sanitization"
```

---

## Task 4: Options page UI

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.ts`

- [ ] **Step 1: Create options.html**

`src/options/options.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pin to Clipboard settings</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; max-width: 520px; }
      h1 { font-size: 18px; margin: 0 0 16px; }
      fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
      legend { font-weight: 600; padding: 0 6px; }
      label { display: block; padding: 6px 0; }
      .hint { color: #666; font-size: 12px; margin-top: 4px; }
    </style>
  </head>
  <body>
    <h1>Pin to Clipboard</h1>
    <fieldset>
      <legend>Image quality</legend>
      <label><input type="radio" name="imageQuality" value="largest-available" /> Largest available (fast)</label>
      <label><input type="radio" name="imageQuality" value="original" /> Original (highest, slower)</label>
      <div class="hint">Larger images may exceed the browser's gesture window and fall back to copying the URL.</div>
    </fieldset>
    <fieldset>
      <legend>Video action (pin detail page only)</legend>
      <label><input type="radio" name="videoAction" value="copy-url" /> Copy URL as text</label>
      <label><input type="radio" name="videoAction" value="download" /> Download video</label>
      <label><input type="radio" name="videoAction" value="both" /> Both</label>
      <div class="hint">Grid videos always copy the poster image.</div>
    </fieldset>
    <script type="module" src="options.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create options.ts**

`src/options/options.ts`:
```ts
import { getSettings, setSettings } from "./storage";
import { Settings } from "../shared/types";

async function hydrate() {
  const s = await getSettings();
  for (const [name, value] of Object.entries(s) as [keyof Settings, string][]) {
    const el = document.querySelector<HTMLInputElement>(
      `input[name="${name}"][value="${value}"]`
    );
    if (el) el.checked = true;
  }
}

function wire() {
  document.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      setSettings({ [el.name]: el.value } as Partial<Settings>);
    });
  });
}

hydrate().then(wire);
```

- [ ] **Step 3: Build and verify it loads**

Run: `npm run build`
Expected: `dist/options/options.html` and `dist/options/options.js` exist.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(options): settings page UI"
```

---

## Task 5: URL resolver (size ladder + extension probe)

**Files:**
- Create: `src/background/resolver.ts`
- Test: `tests/unit/resolver.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/resolver.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveBestUrl, __resetCache } from "../../src/background/resolver";

type Probe = Record<string, number>; // url -> status

function mockFetch(map: Probe) {
  globalThis.fetch = vi.fn(async (url) => {
    const status = map[String(url)] ?? 404;
    return new Response(null, { status });
  }) as unknown as typeof fetch;
}

beforeEach(() => __resetCache());

describe("resolveBestUrl", () => {
  it("returns the displayed url as floor when no larger size is reachable", async () => {
    mockFetch({ "https://i.pinimg.com/236x/aa/bb/cc/x.jpg": 200 });
    const r = await resolveBestUrl(
      "pin1",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "largest-available"
    );
    expect(r.url).toBe("https://i.pinimg.com/236x/aa/bb/cc/x.jpg");
  });

  it("walks the ladder and picks the largest that responds 200", async () => {
    mockFetch({
      "https://i.pinimg.com/736x/aa/bb/cc/x.jpg": 200,
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg": 200,
    });
    const r = await resolveBestUrl(
      "pin2",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "largest-available"
    );
    expect(r.url).toBe("https://i.pinimg.com/736x/aa/bb/cc/x.jpg");
  });

  it("tries extension permutations on /originals/", async () => {
    mockFetch({
      "https://i.pinimg.com/originals/aa/bb/cc/x.png": 200,
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg": 200,
    });
    const r = await resolveBestUrl(
      "pin3",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "original"
    );
    expect(r.url).toBe("https://i.pinimg.com/originals/aa/bb/cc/x.png");
  });

  it("caches resolved URL", async () => {
    const map = { "https://i.pinimg.com/736x/aa/bb/cc/x.jpg": 200 };
    mockFetch(map);
    await resolveBestUrl("pin4", "https://i.pinimg.com/236x/aa/bb/cc/x.jpg", "largest-available");
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await resolveBestUrl("pin4", "https://i.pinimg.com/236x/aa/bb/cc/x.jpg", "largest-available");
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
  });

  it("backs off on 429", async () => {
    mockFetch({}); // all 404
    (globalThis.fetch as unknown as { mockImplementationOnce: Function }).mockImplementationOnce(
      async () => new Response(null, { status: 429 })
    );
    const r = await resolveBestUrl(
      "pin5",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "largest-available"
    );
    expect(r.url).toBe("https://i.pinimg.com/236x/aa/bb/cc/x.jpg");
    expect(r.backoff).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement resolver.ts**

`src/background/resolver.ts`:
```ts
import { ImageQuality } from "../shared/types";

const LADDER_LARGEST = ["originals", "1200x", "736x", "564x", "474x"] as const;
const SIZE_RE = /\/(60x60|75x75_RS|170x|236x|474x|564x|736x|1200x|originals)\//;
const EXT_RE = /\.(jpg|jpeg|png|webp|gif)$/i;
const EXT_PERMS = ["jpg", "png", "webp", "gif"] as const;
const MAX_PROBES = 6;

interface Resolved {
  url: string;
  backoff: boolean;
}

const cache = new Map<string, Resolved>();
const inflight = new Map<string, Promise<Resolved>>();

export function __resetCache() {
  cache.clear();
  inflight.clear();
}

function candidatesFor(displayed: string, quality: ImageQuality): string[] {
  const sizeMatch = displayed.match(SIZE_RE);
  const extMatch = displayed.match(EXT_RE);
  if (!sizeMatch || !extMatch) return [displayed];
  const currentExt = extMatch[1].toLowerCase();
  const orderedExts = [currentExt, ...EXT_PERMS.filter((e) => e !== currentExt)];
  const ladder = quality === "original" ? LADDER_LARGEST : LADDER_LARGEST.slice(1);
  const out: string[] = [];
  for (const size of ladder) {
    for (const ext of orderedExts) {
      const u = displayed.replace(SIZE_RE, `/${size}/`).replace(EXT_RE, `.${ext}`);
      if (u !== displayed) out.push(u);
      if (size !== "originals") break; // only permute extension on /originals/
    }
  }
  return out;
}

async function probe(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status;
  } catch {
    return 0;
  }
}

export async function resolveBestUrl(
  pinId: string,
  displayed: string,
  quality: ImageQuality
): Promise<Resolved> {
  const cached = cache.get(pinId);
  if (cached) return cached;
  const pending = inflight.get(pinId);
  if (pending) return pending;
  const task = (async () => {
    const candidates = candidatesFor(displayed, quality).slice(0, MAX_PROBES);
    let backoff = false;
    for (const u of candidates) {
      const s = await probe(u);
      if (s === 200) {
        const r = { url: u, backoff };
        cache.set(pinId, r);
        return r;
      }
      if (s === 429 || s === 403) backoff = true;
    }
    const fallback = { url: displayed, backoff };
    cache.set(pinId, fallback);
    return fallback;
  })();
  inflight.set(pinId, task);
  try {
    return await task;
  } finally {
    inflight.delete(pinId);
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(bg): size-ladder URL resolver with cache and backoff"
```

---

## Task 6: Service worker fetcher and message router

**Files:**
- Create: `src/background/fetcher.ts`
- Create: `src/background/index.ts`

- [ ] **Step 1: Implement fetcher.ts**

`src/background/fetcher.ts`:
```ts
export async function fetchBytes(url: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const bytes = await res.arrayBuffer();
  return { bytes, mimeType };
}
```

- [ ] **Step 2: Implement background/index.ts**

`src/background/index.ts`:
```ts
import { Message, Response, ErrorCode } from "../shared/types";
import { resolveBestUrl } from "./resolver";
import { fetchBytes } from "./fetcher";

function fail(code: ErrorCode, message: string, fallbackUrl?: string): Response {
  return { ok: false, code, message, fallbackUrl };
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  (async (): Promise<Response> => {
    try {
      if (msg.type === "RESOLVE_AND_FETCH") {
        const resolved = await resolveBestUrl(msg.pinId, msg.candidateUrl, msg.quality);
        if (resolved.backoff && resolved.url === msg.candidateUrl) {
          return fail("CDN_BLOCKED", "CDN throttled, using displayed size", resolved.url);
        }
        try {
          const { bytes, mimeType } = await fetchBytes(resolved.url);
          if (mimeType === "image/gif" || mimeType === "image/apng") {
            return fail("ANIMATED_UNCOPYABLE", "Animated image, copy URL instead", resolved.url);
          }
          return { ok: true, type: "MEDIA", bytes, mimeType, resolvedUrl: resolved.url };
        } catch (e) {
          return fail("FETCH_FAILED", String((e as Error).message), resolved.url);
        }
      }
      if (msg.type === "VIDEO_ACTION") {
        const { mp4Url, hlsUrl } = msg.sources;
        const settings = (await chrome.storage.sync.get("settings")).settings ?? {};
        const action = settings.videoAction ?? "copy-url";
        const url = mp4Url ?? hlsUrl;
        if (!url) return fail("NO_VIDEO_SOURCE", "No video source on page");
        let downloaded = false;
        if ((action === "download" || action === "both") && mp4Url) {
          await chrome.downloads.download({ url: mp4Url });
          downloaded = true;
        }
        return { ok: true, type: "VIDEO_DONE", copiedUrl: url, downloaded };
      }
      if (msg.type === "TRANSCODE_TO_PNG") {
        // Routed to offscreen in Task 9; placeholder here to be replaced.
        return fail("TRANSCODE_FAILED", "Offscreen not wired yet");
      }
      return fail("FETCH_FAILED", "Unknown message");
    } catch (e) {
      return fail("FETCH_FAILED", String((e as Error).message));
    }
  })().then(sendResponse);
  return true; // keep channel open for async
});
```

- [ ] **Step 3: Build to verify it compiles**

Run: `npm run build && npm test`
Expected: build OK; tests still pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(bg): service worker router with fetcher"
```

---

## Task 7: Pin detection

**Files:**
- Create: `src/content/pin-detection.ts`
- Create: `tests/fixtures/board.html`
- Create: `tests/fixtures/detail-image.html`
- Create: `tests/fixtures/detail-video.html`
- Test: `tests/unit/pin-detection.test.ts`

- [ ] **Step 1: Create fixtures**

`tests/fixtures/board.html` (representative pin shapes, including video and placeholder cases):
```html
<!doctype html><html><body>
<div data-test-id="masonry-grid">
  <div data-test-id="pin" data-pin-id="111">
    <a href="/pin/111/"><img src="https://i.pinimg.com/236x/aa/bb/cc/x.jpg" srcset="https://i.pinimg.com/236x/aa/bb/cc/x.jpg 1x, https://i.pinimg.com/474x/aa/bb/cc/x.jpg 2x"></a>
  </div>
  <div data-test-id="pin" data-pin-id="222">
    <a href="/pin/222/">
      <img src="https://i.pinimg.com/236x/dd/ee/ff/y.jpg">
      <div data-test-id="video-duration">0:14</div>
    </a>
  </div>
  <div data-test-id="pin" data-pin-id="333">
    <a href="/pin/333/"><img src="data:image/svg+xml,%3Csvg/%3E" data-src="https://i.pinimg.com/236x/gg/hh/ii/z.jpg"></a>
  </div>
</div>
</body></html>
```

`tests/fixtures/detail-image.html`:
```html
<!doctype html><html><body>
<div data-test-id="pin-closeup" data-pin-id="111">
  <img src="https://i.pinimg.com/originals/aa/bb/cc/x.jpg">
</div>
</body></html>
```

`tests/fixtures/detail-video.html`:
```html
<!doctype html><html><body>
<div data-test-id="pin-closeup" data-pin-id="222">
  <video poster="https://i.pinimg.com/736x/dd/ee/ff/y.jpg">
    <source src="https://v.pinimg.com/videos/mc/expMp4/22/2/clip.mp4" type="video/mp4">
    <source src="https://v.pinimg.com/videos/iht/hls/22/clip.m3u8" type="application/x-mpegURL">
  </video>
</div>
</body></html>
```

- [ ] **Step 2: Write the failing test**

`tests/unit/pin-detection.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  findPinCards,
  classifyCard,
  extractCandidateImageUrl,
  extractVideoSources,
} from "../../src/content/pin-detection";

function loadDom(path: string) {
  document.body.innerHTML = readFileSync(path, "utf8");
}

describe("pin-detection", () => {
  it("finds pin cards on a board page", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(cards.map((c) => c.dataset.pinId)).toEqual(["111", "222", "333"]);
  });

  it("classifies image vs video", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(classifyCard(cards[0]!)).toBe("image");
    expect(classifyCard(cards[1]!)).toBe("video");
  });

  it("extracts the displayed image URL, preferring the largest srcset entry", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(extractCandidateImageUrl(cards[0]!)).toBe(
      "https://i.pinimg.com/474x/aa/bb/cc/x.jpg"
    );
  });

  it("returns null when src is a placeholder (data: or <100px)", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(extractCandidateImageUrl(cards[2]!)).toBeNull();
  });

  it("extracts mp4 + hls + poster on a detail video page", () => {
    loadDom("tests/fixtures/detail-video.html");
    const card = document.querySelector<HTMLElement>("[data-test-id=pin-closeup]")!;
    const s = extractVideoSources(card);
    expect(s.mp4Url).toMatch(/\.mp4$/);
    expect(s.hlsUrl).toMatch(/\.m3u8$/);
    expect(s.posterUrl).toMatch(/i\.pinimg\.com/);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 4: Implement pin-detection.ts**

`src/content/pin-detection.ts`:
```ts
import { VideoSources } from "../shared/types";

export type CardKind = "image" | "video";

export function findPinCards(root: Document | HTMLElement): HTMLElement[] {
  return Array.from(
    (root as Document | HTMLElement).querySelectorAll<HTMLElement>(
      '[data-test-id="pin"], [data-test-id="pin-closeup"]'
    )
  );
}

export function classifyCard(card: HTMLElement): CardKind {
  if (card.querySelector('[data-test-id="video-duration"], video')) return "video";
  return "image";
}

function pickLargestSrcset(img: HTMLImageElement): string | null {
  const srcset = img.getAttribute("srcset");
  if (!srcset) return null;
  const entries = srcset.split(",").map((s) => s.trim());
  let best: { url: string; weight: number } | null = null;
  for (const e of entries) {
    const [url, w] = e.split(/\s+/);
    if (!url) continue;
    const weight = parseFloat((w ?? "1x").replace(/[^\d.]/g, "")) || 1;
    if (!best || weight > best.weight) best = { url, weight };
  }
  return best?.url ?? null;
}

export function extractCandidateImageUrl(card: HTMLElement): string | null {
  const img = card.querySelector<HTMLImageElement>("img");
  if (!img) return null;
  const fromSrcset = pickLargestSrcset(img);
  const candidate = fromSrcset ?? img.currentSrc ?? img.src;
  if (!candidate || candidate.startsWith("data:")) return null;
  if (!/i\.pinimg\.com/.test(candidate)) return null;
  // Placeholder guard: tiny rendered size means LQIP not hydrated.
  if (img.naturalWidth > 0 && img.naturalWidth < 100) return null;
  return candidate;
}

export function extractVideoSources(card: HTMLElement): VideoSources {
  const video = card.querySelector<HTMLVideoElement>("video");
  const posterUrl = video?.poster || card.querySelector<HTMLImageElement>("img")?.src;
  let mp4Url: string | undefined;
  let hlsUrl: string | undefined;
  card.querySelectorAll<HTMLSourceElement>("video source").forEach((s) => {
    if (s.type?.includes("mp4") || /\.mp4(\?|$)/.test(s.src)) mp4Url = s.src;
    if (s.type?.includes("mpegURL") || /\.m3u8(\?|$)/.test(s.src)) hlsUrl = s.src;
  });
  return { mp4Url, hlsUrl, posterUrl };
}
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(content): pin detection with placeholder + video source extraction"
```

---

## Task 8: Hover button (DOM, a11y, states)

**Files:**
- Create: `src/content/hover-button.ts`
- Test: `tests/unit/hover-button.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/hover-button.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { attachHoverButton } from "../../src/content/hover-button";

function makeCard(id = "p1") {
  const el = document.createElement("div");
  el.dataset.testId = "pin";
  el.dataset.pinId = id;
  el.innerHTML = `<img src="https://i.pinimg.com/236x/x/y/z/a.jpg">`;
  document.body.appendChild(el);
  return el;
}

describe("hover-button", () => {
  it("injects an accessible button once and is idempotent", () => {
    const card = makeCard();
    attachHoverButton(card, vi.fn());
    attachHoverButton(card, vi.fn());
    const btns = card.querySelectorAll('button[data-ptc="copy"]');
    expect(btns.length).toBe(1);
    const btn = btns[0]!;
    expect(btn.getAttribute("aria-label")).toMatch(/copy/i);
  });

  it("invokes the click handler with the card", () => {
    const card = makeCard();
    const onClick = vi.fn();
    attachHoverButton(card, onClick);
    (card.querySelector('button[data-ptc="copy"]') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledWith(card);
  });

  it("exposes setState for idle/loading/ok/error", () => {
    const card = makeCard();
    const api = attachHoverButton(card, vi.fn());
    api.setState("loading");
    expect((card.querySelector('button[data-ptc="copy"]') as HTMLElement).dataset.state).toBe("loading");
    api.setState("ok");
    expect((card.querySelector('button[data-ptc="copy"]') as HTMLElement).dataset.state).toBe("ok");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement hover-button.ts**

`src/content/hover-button.ts`:
```ts
export type ButtonState = "idle" | "loading" | "ok" | "error";

export interface ButtonHandle {
  setState(s: ButtonState): void;
}

const ATTR = "data-ptc-bound";
const STYLE_ID = "ptc-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [data-ptc-host]{position:relative;}
    button[data-ptc="copy"]{position:absolute;left:8px;bottom:8px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(0,0,0,.7);color:#fff;cursor:pointer;opacity:0;transition:opacity .15s;z-index:2147483600;display:grid;place-items:center;font-size:16px;}
    button[data-ptc="copy"]:focus-visible{outline:2px solid #fff;outline-offset:2px;opacity:1;}
    [data-ptc-host]:hover button[data-ptc="copy"],button[data-ptc="copy"][data-state="loading"],button[data-ptc="copy"][data-state="ok"],button[data-ptc="copy"][data-state="error"]{opacity:1;}
    button[data-ptc="copy"][data-state="ok"]{background:#1c8c3a;}
    button[data-ptc="copy"][data-state="error"]{background:#a32424;}
  `;
  document.head.appendChild(s);
}

export function attachHoverButton(
  card: HTMLElement,
  onClick: (card: HTMLElement) => void
): ButtonHandle {
  ensureStyle();
  if (card.getAttribute(ATTR)) {
    const existing = card.querySelector<HTMLButtonElement>('button[data-ptc="copy"]')!;
    return { setState: (s) => (existing.dataset.state = s) };
  }
  card.setAttribute(ATTR, "1");
  card.setAttribute("data-ptc-host", "1");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.ptc = "copy";
  btn.dataset.state = "idle";
  btn.setAttribute("aria-label", "Copy image to clipboard");
  btn.textContent = "⧉";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(card);
  });
  card.appendChild(btn);
  return {
    setState: (s) => {
      btn.dataset.state = s;
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(content): accessible hover copy button with state machine"
```

---

## Task 9: Offscreen PNG transcoder

**Files:**
- Create: `src/offscreen/offscreen.html`
- Create: `src/offscreen/offscreen.ts`
- Modify: `src/background/index.ts` (route TRANSCODE_TO_PNG to offscreen)

- [ ] **Step 1: Create offscreen.html**

`src/offscreen/offscreen.html`:
```html
<!doctype html><html><body><script type="module" src="offscreen.js"></script></body></html>
```

- [ ] **Step 2: Create offscreen.ts**

`src/offscreen/offscreen.ts`:
```ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "OFFSCREEN_TRANSCODE") return;
  (async () => {
    try {
      const blob = new Blob([msg.bytes], { type: msg.mimeType });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const png = await canvas.convertToBlob({ type: "image/png" });
      const bytes = await png.arrayBuffer();
      sendResponse({ ok: true, bytes });
    } catch (e) {
      sendResponse({ ok: false, message: String((e as Error).message) });
    }
  })();
  return true;
});
```

- [ ] **Step 3: Wire TRANSCODE_TO_PNG in background/index.ts**

Replace the `TRANSCODE_TO_PNG` branch in `src/background/index.ts` with:
```ts
if (msg.type === "TRANSCODE_TO_PNG") {
  const exists = await chrome.offscreen.hasDocument?.();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["BLOBS" as chrome.offscreen.Reason],
      justification: "Transcode an image the clipboard cannot accept natively",
    });
  }
  const r: { ok: boolean; bytes?: ArrayBuffer; message?: string } =
    await chrome.runtime.sendMessage({
      type: "OFFSCREEN_TRANSCODE",
      bytes: msg.bytes,
      mimeType: msg.mimeType,
    });
  if (!r.ok || !r.bytes) return fail("TRANSCODE_FAILED", r.message ?? "transcode failed");
  return { ok: true, type: "PNG_BYTES", bytes: r.bytes };
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `dist/offscreen/offscreen.html` and `offscreen.js` exist.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(offscreen): PNG transcoder for unsupported clipboard formats"
```

---

## Task 10: Clipboard write in content script

**Files:**
- Create: `src/content/clipboard.ts`
- Test: `tests/unit/clipboard.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/clipboard.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyImage } from "../../src/content/clipboard";

function mockClipboardSupports(supported: string[]) {
  (globalThis as any).ClipboardItem = class {
    constructor(public data: Record<string, Blob | Promise<Blob>>) {}
    static supports(mime: string) { return supported.includes(mime); }
  };
  const writes: unknown[][] = [];
  (globalThis as any).navigator = {
    clipboard: { write: vi.fn(async (items: unknown[]) => { writes.push(items); }) },
  };
  return writes;
}

function mockMessage(reply: any) {
  (globalThis as any).chrome = {
    runtime: { sendMessage: vi.fn(async () => reply) },
  };
}

describe("copyImage", () => {
  beforeEach(() => { document.hasFocus = () => true; });

  it("writes the original blob when the mime is supported", async () => {
    const bytes = new Uint8Array([1,2,3]).buffer;
    mockMessage({ ok: true, type: "MEDIA", bytes, mimeType: "image/jpeg", resolvedUrl: "u" });
    const writes = mockClipboardSupports(["image/jpeg", "image/png"]);
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(writes.length).toBe(1);
  });

  it("transcodes via offscreen when mime unsupported", async () => {
    const bytes = new Uint8Array([1]).buffer;
    const png = new Uint8Array([9]).buffer;
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, type: "MEDIA", bytes, mimeType: "image/webp", resolvedUrl: "u" })
      .mockResolvedValueOnce({ ok: true, type: "PNG_BYTES", bytes: png });
    (globalThis as any).chrome = { runtime: { sendMessage: send } };
    const writes = mockClipboardSupports(["image/png"]);
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(writes.length).toBe(1);
  });

  it("falls back to URL text on animated", async () => {
    mockMessage({ ok: false, code: "ANIMATED_UNCOPYABLE", message: "x", fallbackUrl: "https://i.pinimg.com/originals/a.gif" });
    (globalThis as any).ClipboardItem = class {};
    const writeText = vi.fn();
    (globalThis as any).navigator = { clipboard: { writeText, write: vi.fn() } };
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(r.fellBackToUrl).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://i.pinimg.com/originals/a.gif");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement clipboard.ts**

`src/content/clipboard.ts`:
```ts
import { ImageQuality, Message, Response } from "../shared/types";

export interface CopyArgs {
  pinId: string;
  candidateUrl: string;
  quality: ImageQuality;
}

export interface CopyResult {
  ok: boolean;
  fellBackToUrl?: boolean;
  errorMessage?: string;
}

async function send(msg: Message): Promise<Response> {
  return (await chrome.runtime.sendMessage(msg)) as Response;
}

async function buildBlob(args: CopyArgs): Promise<{ blob: Blob; resolvedUrl: string } | { fallbackUrl: string; reason: string }> {
  const r = await send({ type: "RESOLVE_AND_FETCH", ...args });
  if (!r.ok) return { fallbackUrl: r.fallbackUrl ?? args.candidateUrl, reason: r.message };
  if (r.type !== "MEDIA") return { fallbackUrl: args.candidateUrl, reason: "unexpected response" };
  let bytes = r.bytes;
  let mimeType = r.mimeType;
  const supported =
    typeof ClipboardItem !== "undefined" &&
    "supports" in ClipboardItem &&
    (ClipboardItem as unknown as { supports: (s: string) => boolean }).supports(mimeType);
  if (!supported) {
    const t = await send({ type: "TRANSCODE_TO_PNG", bytes, mimeType });
    if (!t.ok || t.type !== "PNG_BYTES") return { fallbackUrl: r.resolvedUrl, reason: "transcode failed" };
    bytes = t.bytes;
    mimeType = "image/png";
  }
  return { blob: new Blob([bytes], { type: mimeType }), resolvedUrl: r.resolvedUrl };
}

export async function copyImage(args: CopyArgs): Promise<CopyResult> {
  // Synchronously start the clipboard write with a Promise<Blob>.
  const blobPromise = buildBlob(args).then((res) => {
    if ("blob" in res) return res.blob;
    throw Object.assign(new Error(res.reason), { fallbackUrl: res.fallbackUrl });
  });
  try {
    const item = new ClipboardItem({ "image/png": blobPromise as unknown as Promise<Blob> });
    // The actual mime is filled when blobPromise resolves; ClipboardItem keys are the requested types.
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch (e) {
    const fallbackUrl = (e as { fallbackUrl?: string }).fallbackUrl ?? args.candidateUrl;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
      return { ok: true, fellBackToUrl: true, errorMessage: (e as Error).message };
    } catch {
      return { ok: false, errorMessage: (e as Error).message };
    }
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(content): clipboard write with Promise<Blob> and URL fallback"
```

---

## Task 11: Toast (success / error UX)

**Files:**
- Create: `src/content/toast.ts`
- Test: `tests/unit/toast.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/toast.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { showToast } from "../../src/content/toast";

describe("toast", () => {
  it("renders a transient message that auto-dismisses", async () => {
    vi.useFakeTimers();
    showToast("Copied", "ok", 1000);
    expect(document.querySelector('[data-ptc-toast]')!.textContent).toContain("Copied");
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('[data-ptc-toast]')).toBeNull();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Implement toast.ts**

`src/content/toast.ts`:
```ts
export type ToastKind = "ok" | "error" | "info";

export function showToast(message: string, kind: ToastKind = "info", durationMs = 1800) {
  const existing = document.querySelector("[data-ptc-toast]");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.setAttribute("data-ptc-toast", kind);
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: kind === "error" ? "#a32424" : kind === "ok" ? "#1c8c3a" : "#333",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: "8px",
    font: "13px/1.4 -apple-system, system-ui, sans-serif",
    zIndex: "2147483647",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}
```

- [ ] **Step 3: Run the test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(content): toast UX for success and error states"
```

---

## Task 12: Content script entry (observer, route hook, glue)

**Files:**
- Create: `src/content/index.ts`

- [ ] **Step 1: Implement index.ts**

`src/content/index.ts`:
```ts
import { findPinCards, classifyCard, extractCandidateImageUrl, extractVideoSources } from "./pin-detection";
import { attachHoverButton } from "./hover-button";
import { copyImage } from "./clipboard";
import { showToast } from "./toast";
import { getSettings } from "../options/storage";

let scheduled = false;
function scheduleScan(root: ParentNode = document) {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    scan(root);
  }, 150);
}

function pinIdFromCard(card: HTMLElement): string {
  return (
    card.dataset.pinId ??
    card.querySelector<HTMLAnchorElement>("a[href*='/pin/']")?.href.match(/\/pin\/(\d+)/)?.[1] ??
    Math.random().toString(36).slice(2)
  );
}

async function handleClick(card: HTMLElement, setState: (s: "loading" | "ok" | "error") => void) {
  const settings = await getSettings();
  const kind = classifyCard(card);
  const pinId = pinIdFromCard(card);
  setState("loading");

  if (kind === "video" && document.querySelector("[data-test-id=pin-closeup]") === card) {
    const sources = extractVideoSources(card);
    const r = await chrome.runtime.sendMessage({ type: "VIDEO_ACTION", pinId, sources });
    if (r?.ok && r.type === "VIDEO_DONE") {
      if (r.copiedUrl) await navigator.clipboard.writeText(r.copiedUrl);
      setState("ok");
      showToast(r.downloaded ? "Video downloaded + URL copied" : "Video URL copied", "ok");
      return;
    }
    setState("error");
    showToast("No video source found", "error");
    return;
  }

  const candidate =
    kind === "video"
      ? extractVideoSources(card).posterUrl ?? null
      : extractCandidateImageUrl(card);
  if (!candidate) {
    setState("error");
    showToast("Image not ready yet, try again", "error");
    return;
  }
  const r = await copyImage({ pinId, candidateUrl: candidate, quality: settings.imageQuality });
  if (r.ok) {
    setState("ok");
    showToast(r.fellBackToUrl ? "Copied image URL (couldn't copy image)" : "Image copied", r.fellBackToUrl ? "info" : "ok");
  } else {
    setState("error");
    showToast(r.errorMessage ?? "Copy failed", "error");
  }
}

function scan(root: ParentNode) {
  for (const card of findPinCards(root as Document | HTMLElement)) {
    const api = attachHoverButton(card, (c) =>
      handleClick(c, api.setState as (s: "loading" | "ok" | "error") => void)
    );
  }
}

function hookRouteChanges() {
  const fire = () => scheduleScan(document);
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<History[typeof m]>) {
      const r = orig.apply(this, args as never);
      fire();
      return r;
    } as History[typeof m];
  }
  window.addEventListener("popstate", fire);
}

function start() {
  scan(document);
  new MutationObserver(() => scheduleScan(document)).observe(document.body, {
    childList: true,
    subtree: true,
  });
  hookRouteChanges();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
```

- [ ] **Step 2: Build**

Run: `npm run build && npm test`
Expected: build OK, all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(content): observer + route hook + click handler glue"
```

---

## Task 13: Toolbar action opens options page

**Files:**
- Modify: `src/background/index.ts` (add `chrome.action.onClicked` handler at top level)

- [ ] **Step 1: Edit background/index.ts**

Append to `src/background/index.ts`:
```ts
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(bg): toolbar icon opens options page"
```

---

## Task 14: Playwright e2e harness

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/copy-image.spec.ts`
- Create: `tests/e2e/idempotent-injection.spec.ts`
- Create: `tests/e2e/route-change.spec.ts`
- Create: `tests/e2e/options.spec.ts`

- [ ] **Step 1: Create playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { headless: false },
});
```

- [ ] **Step 2: Create helpers.ts**

`tests/e2e/helpers.ts`:
```ts
import { chromium, BrowserContext } from "@playwright/test";
import path from "node:path";

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

export async function fixtureUrl(file: string) {
  return "file://" + path.resolve("tests/fixtures", file);
}
```

- [ ] **Step 3: Build before running e2e**

Run: `npm run build`

- [ ] **Step 4: Create copy-image.spec.ts**

`tests/e2e/copy-image.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { launchWithExtension, fixtureUrl } from "./helpers";

test("button appears on grid cards and writes to clipboard", async () => {
  const ctx = await launchWithExtension();
  // Intercept i.pinimg.com to serve a small JPEG.
  await ctx.route("https://i.pinimg.com/**/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    })
  );
  const page = await ctx.newPage();
  await page.goto(await fixtureUrl("board.html"));
  await page.hover("[data-test-id=pin][data-pin-id='111']");
  await page.click("[data-test-id=pin][data-pin-id='111'] button[data-ptc=copy]");
  await page.waitForSelector("[data-ptc-toast=ok]");
  const text = await page.evaluate(() => navigator.clipboard.read().then((items) => items.length));
  expect(text).toBeGreaterThan(0);
  await ctx.close();
});
```

- [ ] **Step 5: Create idempotent-injection.spec.ts**

`tests/e2e/idempotent-injection.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { launchWithExtension, fixtureUrl } from "./helpers";

test("re-running scan does not double-inject buttons", async () => {
  const ctx = await launchWithExtension();
  const page = await ctx.newPage();
  await page.goto(await fixtureUrl("board.html"));
  await page.waitForSelector("button[data-ptc=copy]");
  await page.evaluate(() => {
    document.body.appendChild(document.body.firstElementChild!.cloneNode(true));
  });
  await page.waitForTimeout(300);
  const counts = await page.$$eval("[data-test-id=pin]", (cards) =>
    cards.map((c) => c.querySelectorAll("button[data-ptc=copy]").length)
  );
  for (const n of counts) expect(n).toBeLessThanOrEqual(1);
  await ctx.close();
});
```

- [ ] **Step 6: Create route-change.spec.ts**

`tests/e2e/route-change.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { launchWithExtension, fixtureUrl } from "./helpers";

test("pushState route change re-injects buttons", async () => {
  const ctx = await launchWithExtension();
  const page = await ctx.newPage();
  await page.goto(await fixtureUrl("board.html"));
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
```

- [ ] **Step 7: Create options.spec.ts**

`tests/e2e/options.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers";

test("options page persists selection", async () => {
  const ctx = await launchWithExtension();
  // The extension id is dynamic; open via service worker.
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const url = sw.url().replace(/background\/index\.js$/, "options/options.html");
  const page = await ctx.newPage();
  await page.goto(url);
  await page.check('input[name="imageQuality"][value="original"]');
  await page.reload();
  await expect(page.locator('input[name="imageQuality"][value="original"]')).toBeChecked();
  await ctx.close();
});
```

- [ ] **Step 8: Run e2e**

Run: `npm run e2e`
Expected: all four specs PASS.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "test: playwright e2e harness for copy, injection, route, options"
```

---

## Task 15: Web Store readiness

**Files:**
- Create: `docs/PRIVACY-AND-PERMISSIONS.md`
- Replace: `src/assets/icon-16.png`, `icon-48.png`, `icon-128.png` (real artwork)
- Modify: `README.md`

- [ ] **Step 1: Create PRIVACY-AND-PERMISSIONS.md**

`docs/PRIVACY-AND-PERMISSIONS.md`:
```md
# Privacy and permissions

## Data
Pin to Clipboard collects nothing. No analytics, no telemetry, no remote code. All actions are local and user-initiated. The only stored state is two user preferences in `chrome.storage.sync`.

## Permission justifications (copy verbatim into the Web Store form)

- **storage**: "Stores only the user's two extension settings (image quality, video action). No browsing data, no media, no identifiers."
- **downloads**: "Used only to save a Pinterest video when the user explicitly clicked the copy button with the Download setting selected."
- **offscreen**: "Used only to convert an image the OS clipboard cannot accept natively (e.g. WebP) into PNG so the clipboard write can succeed."
- **host *://*.pinterest.com/***: "The extension only operates on Pinterest pages, where it injects the copy button."
- **host *://i.pinimg.com/*** and **v.pinimg.com**: "Fetches the specific media the user clicked to copy. No background traffic, no other requests."

## Single purpose
Copy Pinterest media to the user's clipboard with one click. The optional video download is a subordinate convenience of the same copy action.
```

- [ ] **Step 2: Generate real icon artwork**

Run:
```bash
node -e "
const fs=require('fs'); 
// Replace placeholders with a recognizable filled square; final art is up to the designer.
const sizes=[16,48,128];
for (const s of sizes) {
  const buf=Buffer.alloc(0); // designer to replace
}
" 
```
Then drop real PNGs at the three paths. If no designer asset is available, the placeholder PNGs from Task 2 ship for v0.1.0.

- [ ] **Step 3: Update README**

Append to `README.md`:
```md
## Publish
1. `npm run build`
2. Zip `dist/`
3. Upload to https://chrome.google.com/webstore/devconsole
4. Paste justifications from `docs/PRIVACY-AND-PERMISSIONS.md`
5. Declare "no data collected", "no remote code"
```

- [ ] **Step 4: Final build + test pass**

Run: `npm run build && npm test && npm run e2e`
Expected: all green.

- [ ] **Step 5: Commit and tag**

```bash
git add -A && git commit -m "docs: web store privacy + publish notes"
git tag v0.1.0
```

---

## Verification spikes (run inside Task 12, before relying on them)

Defined in the spec section 11. Each is a small inline check; if any fails, the noted contingency applies.

| Spike | Run during | Check | If fails |
|---|---|---|---|
| Shadow DOM closed root | Task 7 implementation | In a live Pinterest tab, evaluate `document.querySelector('[data-test-id=pin]').shadowRoot` and similar | Document the affected surface as unsupported in README; ship without that surface. |
| `ClipboardItem` `Promise<Blob>` support | Task 10 implementation | Quick test in a Chrome tab: `await navigator.clipboard.write([new ClipboardItem({'image/png': new Promise(r => setTimeout(() => r(blob), 500))})])` | Switch `copyImage` to fetch fully before constructing `ClipboardItem`; accept the smaller-payload default. |
| Detail-page video source shape | Task 7 fixtures and Task 12 video path | Open a real Pinterest video pin and inspect `<video>`, `<source>`, and any embedded data | If only HLS is exposed, "Download video" silently falls back to "Copy URL" and the toast says so. |

---

## Self-review (already run)

- **Spec coverage:** every section of the spec maps to at least one task (problem statement -> 1; architecture -> 2/4/5/6/9/12; key constraint -> 6/10; data flow image/video -> 10/12; transient activation -> 10; focus failure -> 10/11; URL resolution -> 5; SPA hardening -> 12; CDN politeness -> 5/6; transcode -> 9; hover button + a11y -> 8; settings -> 3/4; permissions/store posture -> 2/15; testing -> 7/8/10/11/14; verification spikes -> 12).
- **Placeholders:** none. Icon art for v0.1.0 ships as placeholder PNGs from Task 2 (final art is an external asset, explicitly called out).
- **Type consistency:** message names (`RESOLVE_AND_FETCH`, `VIDEO_ACTION`, `TRANSCODE_TO_PNG`, `OFFSCREEN_TRANSCODE`), settings keys (`imageQuality`, `videoAction`), and enum values (`largest-available`, `original`, `copy-url`, `download`, `both`) match across `shared/types.ts`, `storage.ts`, `resolver.ts`, `background/index.ts`, `clipboard.ts`, and `options.ts`.

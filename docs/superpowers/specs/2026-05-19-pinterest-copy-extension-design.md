---
title: "Pin to Clipboard: Chrome Extension Design"
type: plan
status: draft
date: 2026-05-19
summary: "MV3 Chrome extension that adds a one-click button to copy a Pinterest pin's image to the clipboard from the grid, home feed, and search, plus a configurable video action on the detail page."
tags: [chrome-extension, manifest-v3, pinterest, clipboard]
projects: [pin-to-clipboard]
---

# Pin to Clipboard: Chrome Extension Design

## 1. Problem

Pinterest only offers a native "Copy Image" on the **pin detail page**. On the board grid, home feed, and search results, each pin is rendered as an `<a>` link with the image painted as a CSS background (or hidden behind an overlay link), so there is no `<img>` element under the cursor and Chrome's context menu only offers "Copy Link Address". To get the actual image bytes onto the clipboard you must open every pin individually. This extension removes that friction.

## 2. Goal and single purpose

**Single purpose:** copy a Pinterest pin's media to the clipboard with one click.

In scope:

- One-click **copy image to clipboard** on grid / home / search / detail pins.
- On **video pins in the grid**: copy the poster (cover) image, so the button behaves consistently ("you always get an image").
- On the **pin detail page** for video pins: a configurable action (copy video URL as text / download the video / both), since the video URL only exists in that context.
- An **options page** (opens from the toolbar icon) for two settings.

Out of scope (YAGNI): bulk / multi-select copy, board export, copying to Figma specifically, Firefox/Edge stores, accounts, sync beyond `chrome.storage.sync` settings.

Target: **Chrome only**, published to the Chrome Web Store.

## 3. Why the naive approach fails (key constraint)

A content script **cannot** fetch the image and read it via canvas:

- Chrome removed content-script CORS-bypass (Chrome 73/85, 2019-2020). `host_permissions` grants CORS-bypass only to **extension-process contexts** (service worker, extension pages, offscreen documents), never the content script's renderer. `fetch('https://i.pinimg.com/...')` from a content script fails CORS.
- The on-page `<img>` was loaded without `crossorigin="anonymous"`, so drawing it to a canvas **taints** the canvas and `canvas.toBlob()` throws `SecurityError`.

Therefore the image bytes must be fetched in the **service worker** (which legitimately bypasses CORS with `host_permissions`), and the clipboard write must happen in a **DOM context with a user gesture and focus** (the content script), because service workers have no `navigator.clipboard`.

## 4. Architecture

Four parts in one MV3 extension:

| Part | Responsibility |
|---|---|
| `content.js` (injected on `*://*.pinterest.com/*`) | Detect pins on the SPA, inject the hover button, capture the click gesture, request bytes from the SW, perform `navigator.clipboard.write`, render success/error UX. |
| `background.js` (service worker) | CORS-bypass `fetch` of the image; the size-ladder/extension resolution probe with caching + backoff; `chrome.downloads` for the video-download option; read settings. |
| `offscreen.html` / `offscreen.js` | Last-resort image transcode to PNG for formats the clipboard cannot take directly (animated/WebP). Created on demand, closed when idle. |
| `options.html` / `options.js` | Settings UI, opened by the toolbar action. |

### 4.1 Data flow: copy image

```
[content.js] hover button click  (user gesture + page focused)
      |  chrome.runtime.sendMessage({type:'RESOLVE_AND_FETCH', pinId, candidateUrl})
      v
[background.js]  resolve best URL (size-ladder + ext probe, cached)
                 fetch(url)            <-- CORS-bypass works here
                 -> ArrayBuffer + mimeType
      |  sendResponse({buffer, mimeType}) | or {error}
      v
[content.js]  blob = new Blob([buffer], {type:mimeType})
              if !ClipboardItem.supports(mimeType):
                  -> ask offscreen to transcode to image/png
              clipboard.write([new ClipboardItem({[type]: blob})])
              -> show check / error toast on the button
```

To keep the clipboard write inside the transient-activation window (see 5.1), the content script constructs the `ClipboardItem` with a **`Promise<Blob>`** that resolves when the SW responds, and calls `navigator.clipboard.write([...])` **synchronously inside the click handler** before awaiting anything.

### 4.2 Data flow: video pin

- **Grid video pin:** treated as an image copy of the poster frame. The poster is a normal `i.pinimg.com` image referenced by the card, so it goes through the exact image path in 4.1. No video URL is touched on the grid (it is not present in the grid DOM).
- **Detail-page video pin:** the detail view exposes the video sources (HLS `.m3u8` and/or `.mp4` on `v.pinimg.com`). The button action follows the **Video action** setting:
  - `Copy URL as text` (default): copy the best available video URL (prefer `.mp4`; if only HLS exists, copy the `.m3u8` URL and show a one-line note in the toast that it is an HLS stream).
  - `Download video`: SW issues `chrome.downloads.download` for the `.mp4` if present; if only HLS exists, fall back to copying the URL and inform the user (no client-side HLS muxing in v1, that is out of scope).
  - `Both`: copy URL and trigger the download.

## 5. Hard problems and how the design handles them

### 5.1 Transient activation window

A multi-MB `originals` fetch can outlast the ~1s user-activation window, making `clipboard.write` throw `NotAllowedError`. Mitigations:

- Call `navigator.clipboard.write()` synchronously in the click handler with a `Promise<Blob>`-backed `ClipboardItem`.
- Prefer the **largest already-available rendered size** by default over `originals` (see settings 7) to keep payloads small.
- On `NotAllowedError`/focus failure, fall back to copying the **image URL as text** and show an explanatory toast. Never fail silently.

### 5.2 Focus failures

`navigator.clipboard.write` rejects if the document is not focused (DevTools focused, alt-tabbed, foreign iframe focused). These are expected runtime states. Handling: detect the rejection, show the error toast, fall back to URL-text copy, and instruct the user to click the page once and retry.

### 5.3 Image URL resolution (replaces the naive `/236x/ -> /originals/` swap)

`i.pinimg.com` paths encode both a size segment and a file extension. `originals` often has a **different extension** than the thumbnail, and frequently **does not exist** at all (largest real asset may be `/736x/`). Algorithm, run in the SW and cached per pin id:

1. Build the candidate ladder, largest first: `originals`, `1200x`, `736x`, `564x`, `474x`, then the rendered `src`/`srcset` entry as the floor.
2. For the `originals` candidate, try the extension permutation `{.jpg, .png, .webp, .gif}` (the source thumbnail's extension first).
3. Use `fetch` with `method:'HEAD'` to probe; first 200 wins. Bounded to at most 6 probes per pin.
4. Cache the resolved URL keyed by pin id; dedupe in-flight resolutions; exponential backoff on 429/403 from the CDN.
5. If nothing above the floor resolves, use the rendered image as-is.

Explicit outcomes (first-class, not generic 404 fallbacks):

- **No originals exists** -> use largest resolved size, no error shown.
- **Animated GIF / animated WebP** -> the clipboard has no reliable animated image format; copy the image URL as text and toast "animated image copied as link".
- **Blurred placeholder not yet hydrated** -> if the resolved image is below a min-dimension threshold (e.g. < 200px) or the card still shows the LQIP, wait for the card's real `src`/`srcset` to populate (IntersectionObserver hydration) before enabling the button; the button shows a brief spinner instead of copying the blur.

### 5.4 SPA hardening

Pinterest is a client-side-routed React SPA with infinite scroll:

- Patch `history.pushState` / `replaceState` and listen for `popstate` to detect route changes (board -> home -> search) and re-bind.
- `MutationObserver` on a stable high-level feed container, debounced (~150ms), to catch newly virtualized cards.
- Injection is **idempotent**: each card is marked with a `data-ptc-bound` attribute; re-injection is a no-op. Survives React re-render reconciliation by re-checking the marker on each observer tick.
- **Shadow DOM check (must verify in implementation):** confirm whether Pinterest card surfaces use closed shadow roots. If a target card is inside a closed root it is uninjectable from outside and that surface is documented as unsupported. This must be checked early in implementation, before building the injection layer.

### 5.5 CDN politeness

The resolution probe can issue several HEADs per click; click-spamming multiplies this. Controls: per-pin resolved-URL cache, in-flight dedupe, max 6 probes per pin, exponential backoff on 429/403, and a user-facing "could not resolve full resolution, copied displayed size" rather than silent failure.

### 5.6 Image transcode (only when required)

Do **not** canvas-re-encode by default (re-encoding a 4000px JPEG to PNG can balloon to tens of MB and blow the gesture window). Write the original blob directly via `new ClipboardItem({[blob.type]: blob})` after `ClipboardItem.supports(blob.type)` feature-detection. Only when `supports()` is false (e.g. static WebP that Chrome will not take) transcode **once** to `image/png` in the offscreen document, never in the tainted content-script canvas.

## 6. The hover button

- Small circular button, **bottom-left** of the card, fades in on card hover, visual weight matching Pinterest's own hover controls.
- Placement is computed relative to the card and avoids overlaying Pinterest's own hover affordances (Merken top-right, Bild suchen bottom-right). Placement resilience and a manual re-check item are in the test matrix because Pinterest moves these controls frequently.
- States: idle -> spinner (resolving/fetching) -> check (success, ~1.2s) or error (with a one-line toast and the URL-fallback already applied).
- **Accessibility:** rendered as a real `<button>` with `aria-label="Copy image to clipboard"`, keyboard focusable, activatable with Enter/Space, visible focus ring. Not mouse-only.

## 7. Settings (options page, opens from toolbar icon)

Stored in `chrome.storage.sync`.

| Setting | Options | Default | Notes |
|---|---|---|---|
| Image quality | `Largest available (fast)` / `Original (highest, slower)` | Largest available | Default avoids the gesture-window risk of multi-MB originals (5.1). |
| Video action (detail page) | `Copy URL as text` / `Download video` / `Both` | Copy URL as text | Applies only on the pin detail page (4.2). |

No further knobs in v1.

## 8. Permissions and Web Store posture

| Permission | Why | Justification text (for the review form) |
|---|---|---|
| `storage` | Persist the two settings | "Stores only the user's two extension settings locally/synced. No browsing data." |
| `downloads` | "Download video" option on the detail page | "Used solely to save a Pinterest video the user explicitly clicked to download." |
| `offscreen` | Last-resort PNG transcode for unsupported image formats | "Used only to convert an image the clipboard cannot accept natively into PNG." |
| host `*://*.pinterest.com/*` | Inject the button UI | "The extension only operates on Pinterest pages." |
| host `*://i.pinimg.com/*`, `*://v.pinimg.com/*` | Fetch the pin image/video bytes the user asked to copy | "Fetches only the specific media the user clicked to copy. No other requests." |

Notes:

- `clipboardWrite` is **not** declared: `navigator.clipboard.write()` triggered by a user gesture in a focused page does not require it. Declaring it would be an unnecessary-permission flag.
- Single-purpose framing for the listing: "Copy Pinterest media to your clipboard." The video download is presented as a subordinate convenience of the same copy action, not a second feature, to satisfy the single-purpose policy. If review flags `downloads`, the contingency is to ship without the download option (settings collapse to Copy URL only) rather than delay the listing.
- Privacy form: declare **no data collected**, **no remote code**, all actions are local and user-initiated.

## 9. Testing

Unit-testing the URL-rewrite logic alone covers only the low-risk part. Required:

**Automated (Playwright, extension loaded):**

- URL resolution: ladder + extension permutation, originals-missing, animated, placeholder-below-threshold.
- Cross-context round trip: content -> SW fetch -> ArrayBuffer back -> clipboard write succeeds (assert clipboard contents).
- Offscreen transcode path for an unsupported format.
- Idempotent injection after a simulated `pushState` route change.

**Manual matrix:**

Pages: board, home feed, search results, detail.
Pin types: image, video (grid -> poster), animated GIF, no-originals pin, blurred-placeholder-not-yet-hydrated.
Failure states: DevTools focused, document unfocused / alt-tabbed, slow network (gesture expired), CDN 429.
Plus: button does not cover Pinterest's own controls; keyboard-only activation; re-injection after route change.

## 10. Build, package, ship

- Plain MV3, no framework needed (vanilla TS, esbuild bundle). Repo: `~/software-dev/pin-to-clipboard`.
- Lint + unit + Playwright in CI before packaging.
- Web Store listing assets (icon set, screenshots from a real board, description, privacy justifications from section 8) produced as part of the release task.

## 11. Open verification items (resolve during implementation, before the dependent layer is built)

1. Shadow DOM: are Pinterest grid cards in a closed root? (Blocks 5.4 injection layer.)
2. `ClipboardItem` `Promise<Blob>` support on the current stable Chrome (blocks 5.1 approach; fallback is to fetch fully then write, accepting the smaller-payload default in 7).
3. Detail-page video source shape: confirm `.mp4` on `v.pinimg.com` vs HLS-only, to finalize 4.2 download behavior.

These are spikes inside implementation, not unknowns that change the design's shape.

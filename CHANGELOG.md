# Changelog

## 0.1.1 : 2026-05-23

### Fixed
- **Image copy actually copies the image** (was always falling back to copying the URL). Root cause: Chrome's extension messaging silently strips `ArrayBuffer` payloads, so the image bytes never made it to the transcoder. Collapsed the path to a single `COPY_IMAGE` message and pass bytes as base64; transcode to PNG runs in the content script on local bytes (canvas is not tainted). Removes the offscreen document, the `offscreen` permission, and two message types.

### Changed
- **Pinterest red UI.** Hover button uses Pinterest red (`#E60023`), white SVG icons (copy / spinner / check / X), subtle elevation, and a slide-up appearance on hover. Toast switches to a Pinterest-dark pill.
- **Toast wording cleaned up.** Successful copy: "Image copied". Image-failed-URL-copied: "Couldn't copy image, copied URL instead".

### Added
- **Graceful "Extension context invalidated" handling.** When the extension is reloaded while a Pinterest tab is open, the orphaned content script now shows "Please reload this page (extension was updated)" instead of throwing into the console.
- **Real extension icons.** `src/assets/icon.svg` source, plus `npm run build:icons` (uses `sharp`) to render the 16/48/128 PNGs.
- `docs/STORE-LISTING.md` with ready-to-paste copy for the Chrome Web Store listing.

### Removed
- `[PtC]` debug instrumentation across content script, service worker, and offscreen document.
- The offscreen document, the `offscreen` permission, and the `TRANSCODE_TO_PNG` / `OFFSCREEN_TRANSCODE` messages (no longer needed).

## 0.1.0 : 2026-05-19

Initial implementation. One-click copy button on Pinterest grid, home, search, and detail. Options page (image quality, video action). Resolver with size-ladder probe + cache + backoff. Service-worker fetch, offscreen transcode. Playwright e2e harness (env-gated).

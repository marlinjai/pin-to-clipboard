# Chrome Web Store listing copy

Ready-to-paste text for the Chrome Web Store developer dashboard.

## Name

Pin to Clipboard

## Short description (max 132 characters)

One-click copy of any Pinterest pin's image to your clipboard, straight from the board, home feed, or search.

## Detailed description

Pinterest only lets you "Copy Image" from a pin's detail page. Pin to Clipboard adds a small red copy button to every pin on the board view, home feed, and search results, so you can grab an image and paste it anywhere with one click.

**What it does**

- Adds a hover-only copy button to each pin on the grid, home, and search.
- One click copies the full-resolution image (or the largest available size) to your system clipboard, ready to paste into Google Docs, Slack, Figma, Notion, an email, or anywhere else.
- Works on video pins too: copies the poster image on the grid, and on the pin detail page you can choose to copy the video URL or download it.
- Keyboard accessible: the button is a real `<button>` with an aria-label, focusable, activated with Enter or Space.

**Settings (toolbar icon)**

- Image quality: largest available (fast) or original (highest resolution).
- Video action on the pin detail page: copy URL, download, or both.

**Privacy**

Pin to Clipboard collects nothing. No analytics, no telemetry, no remote code. The only stored state is your two extension settings, synced via Chrome's own `storage.sync`. The extension only runs on `pinterest.com` and only fetches the specific media you click to copy. See `docs/PRIVACY-AND-PERMISSIONS.md` in the source repository for the full permission rationale.

**Open source**

MIT licensed. Source: https://github.com/marlinjai/pin-to-clipboard

## Category

Productivity

## Single purpose (form field)

Copy a Pinterest pin's image to the user's clipboard with one click. The optional video URL/download on the pin detail page is a subordinate convenience of the same copy action.

## Permission justifications

Paste these verbatim into the per-permission justification fields in the dashboard.

- **storage**: "Stores only the user's two extension settings (image quality, video action). No browsing data, no media, no identifiers."
- **downloads**: "Used only to save a Pinterest video when the user explicitly clicked the copy button with the Download setting selected."
- **host `*://*.pinterest.com/*`**: "The extension only operates on Pinterest pages, where it injects the copy button."
- **host `*://i.pinimg.com/*`** and **`*://v.pinimg.com/*`**: "Fetches the specific media the user clicked to copy. No background traffic, no other requests."

## Privacy practices form

- **Single purpose**: see above.
- **Data collected**: none.
- **Sold or transferred to third parties**: no.
- **Used for purposes unrelated to the single purpose**: no.
- **Used to determine creditworthiness**: no.
- **Remote code**: no.

## Privacy policy URL

`<provide a public URL: e.g. GitHub Pages, a Gist, or the markdown file in a public repo>`

## Screenshot direction (capture before submission)

The store requires at least 1 screenshot (1280 x 800 or 640 x 400), up to 5. Recommended captures:

1. **Hero**: a board view with the red copy button visible on hover at the bottom-left of a pin. Include a couple of other pins for context.
2. **Confirmation**: the same board view with the "Image copied" toast at the bottom of the screen.
3. **Options page**: the settings UI.
4. **Detail page**: a video pin's detail view with the copy button (showing video-action support).
5. **Before/after**: native Pinterest right-click on the grid (no Copy Image) next to the extension's button.

## Pre-submission checklist

- [ ] `npm run build` runs clean.
- [ ] `npm test` is green.
- [ ] `dist/` zipped (skip `node_modules`, source maps optional).
- [ ] Privacy policy URL live and public.
- [ ] All five screenshots captured.
- [ ] Pasted permission justifications above.
- [ ] Declared "no data collected" + "no remote code" in the privacy form.
- [ ] Version bumped in `src/manifest.json`.

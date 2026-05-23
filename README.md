# Pin to Clipboard

Chrome MV3 extension that adds a one-click copy button to Pinterest pins on the board view, home feed, and search results.

## Develop

- `npm install`
- `npm run build:watch`
- Load `dist/` as an unpacked extension at `chrome://extensions`
- `npm test` (unit, vitest), `PTC_E2E=1 npm run e2e` (Playwright, env-gated)

## Icons

The extension icons are generated from `src/assets/icon.svg`:

```
npm run build:icons
```

This renders `icon-16.png`, `icon-48.png`, `icon-128.png` via `sharp`.

## Publish to the Chrome Web Store

1. `npm run build`
2. Zip the contents of `dist/` (the contents, not the folder).
3. Upload at https://chrome.google.com/webstore/devconsole.
4. Use the copy in `docs/STORE-LISTING.md` for the listing fields and permission justifications.
5. Use the privacy text in `docs/PRIVACY-AND-PERMISSIONS.md`.
6. Provide a public privacy policy URL in the dashboard.
7. Declare "no data collected" and "no remote code" in the privacy form.

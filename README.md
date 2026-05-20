# Pin to Clipboard

Chrome MV3 extension that adds a one-click copy button to Pinterest pins.

## Develop

- `npm install`
- `npm run build:watch`
- Load `dist/` as an unpacked extension at `chrome://extensions`
- `npm test` (unit), `npm run e2e` (Playwright)

## Publish
1. `npm run build`
2. Zip `dist/`
3. Upload to https://chrome.google.com/webstore/devconsole
4. Paste justifications from `docs/PRIVACY-AND-PERMISSIONS.md`
5. Declare "no data collected", "no remote code"

## Status
v0.1.0 ships with placeholder icons. Replace `src/assets/icon-{16,48,128}.png` with final artwork before public listing.

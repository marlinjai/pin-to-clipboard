# Roadmap

**This file is the only index of open work in this repository.** Every open item has exactly one home: a plan under `docs/superpowers/plans/` or `docs/superpowers/specs/` when it carries a decision or a sequence (the line here links it), or a single line under Leftovers when it does not. Every open line ends with the date it was last confirmed. `roadmap-check` in CI fails a line older than 30 days, an open line on a finished plan, or a live plan indexed nowhere. Rule and line grammar: `document-lifecycle.md` in the `knowledge-base` repository, section 4.

This repository has been dormant since 2026-05-23. Its default branch is `master`, not `main`.

## Leftovers (clear, do not carry)

- [ ] The extension is fully built and packaged (v0.1.1 zip, store screenshots,
      listing assets, GitHub Pages privacy site all committed) but the Chrome Web
      Store submission was left at the last steps: verify the publisher contact
      email at the developer console account page, then the listing checklist
      (privacy fields, flip "remote code" to No, single-purpose wording,
      description), then Submit for review. Needs Marlin in the Chrome Web Store
      developer console, not something this session executes (2026-09-10)

- [ ] A smart-naming feature was decided but never implemented: the alt-text slug
      as the primary download filename via `chrome.downloads.download({filename})`
      (the clipboard itself cannot carry a filename), plus a bring-your-own-key
      Anthropic Haiku vision fallback when the alt text is empty, plus multi-select
      pins downloaded as a single zip. Whether Chrome's built-in Prompt API is
      usable instead of the Haiku fallback is still an open question. Relevant
      code: `src/content/clipboard.ts`, `src/content/pin-detection.ts`,
      `src/background/index.ts`. No plan or pull request exists yet; the decision
      itself needs no further input from Marlin, but implementing three new
      features in a dormant repo is bigger than this home-and-close session
      (2026-09-10)

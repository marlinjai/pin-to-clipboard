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

// chrome.* calls on a content script whose extension was reloaded throw
// "Extension context invalidated." The tab still has the orphaned content
// script until the page is reloaded. Detect and tell the user once.
function isContextInvalidated(e: unknown): boolean {
  return /Extension context invalidated/i.test(String((e as Error)?.message ?? ""));
}

async function handleClick(
  card: HTMLElement,
  setState: (s: "loading" | "ok" | "error") => void
) {
  try {
    const settings = await getSettings();
    const kind = classifyCard(card);
    const pinId = pinIdFromCard(card);
    setState("loading");

    if (kind === "video" && document.querySelector("[data-test-id=pin-closeup]") === card) {
      const sources = extractVideoSources(card);
      const r = (await chrome.runtime.sendMessage({ type: "VIDEO_ACTION", pinId, sources })) as {
        ok: boolean;
        type?: string;
        copiedUrl?: string;
        downloaded?: boolean;
      };
      if (r?.ok && r.type === "VIDEO_DONE") {
        if (r.copiedUrl) await navigator.clipboard.writeText(r.copiedUrl);
        setState("ok");
        showToast(r.downloaded ? "Video downloaded, URL copied" : "Video URL copied", "ok");
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
      showToast(
        r.fellBackToUrl ? "Couldn't copy image, copied URL instead" : "Image copied",
        r.fellBackToUrl ? "info" : "ok"
      );
    } else {
      setState("error");
      showToast(r.errorMessage ?? "Copy failed", "error");
    }
  } catch (e) {
    setState("error");
    if (isContextInvalidated(e)) {
      showToast("Please reload this page (extension was updated)", "error");
    } else {
      showToast("Copy failed", "error");
    }
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

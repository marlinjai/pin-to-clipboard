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
      return fail("FETCH_FAILED", "Unknown message");
    } catch (e) {
      return fail("FETCH_FAILED", String((e as Error).message));
    }
  })().then(sendResponse);
  return true; // keep channel open for async
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

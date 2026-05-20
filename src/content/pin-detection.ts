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

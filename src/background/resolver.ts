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
  const currentExt = extMatch[1]!.toLowerCase();
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

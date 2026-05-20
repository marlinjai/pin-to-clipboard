import { ImageQuality, Message, Response } from "../shared/types";

export interface CopyArgs {
  pinId: string;
  candidateUrl: string;
  quality: ImageQuality;
}

export interface CopyResult {
  ok: boolean;
  fellBackToUrl?: boolean;
  errorMessage?: string;
}

async function send(msg: Message): Promise<Response> {
  return (await chrome.runtime.sendMessage(msg)) as Response;
}

async function buildBlob(args: CopyArgs): Promise<{ blob: Blob; resolvedUrl: string } | { fallbackUrl: string; reason: string }> {
  const r = await send({ type: "RESOLVE_AND_FETCH", ...args });
  if (!r.ok) return { fallbackUrl: r.fallbackUrl ?? args.candidateUrl, reason: r.message };
  if (r.type !== "MEDIA") return { fallbackUrl: args.candidateUrl, reason: "unexpected response" };
  let bytes = r.bytes;
  let mimeType = r.mimeType;
  if (mimeType !== "image/png") {
    const t = await send({ type: "TRANSCODE_TO_PNG", bytes, mimeType });
    if (!t.ok || t.type !== "PNG_BYTES") return { fallbackUrl: r.resolvedUrl, reason: "transcode failed" };
    bytes = t.bytes;
    mimeType = "image/png";
  }
  return { blob: new Blob([bytes], { type: mimeType }), resolvedUrl: r.resolvedUrl };
}

export async function copyImage(args: CopyArgs): Promise<CopyResult> {
  // Synchronously start the clipboard write with a Promise<Blob>.
  const blobPromise = buildBlob(args).then((res) => {
    if ("blob" in res) return res.blob;
    throw Object.assign(new Error(res.reason), { fallbackUrl: res.fallbackUrl });
  });
  try {
    const item = new ClipboardItem({ "image/png": blobPromise as unknown as Promise<Blob> });
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch (e) {
    const fallbackUrl = (e as { fallbackUrl?: string }).fallbackUrl ?? args.candidateUrl;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
      return { ok: true, fellBackToUrl: true, errorMessage: (e as Error).message };
    } catch {
      return { ok: false, errorMessage: (e as Error).message };
    }
  }
}

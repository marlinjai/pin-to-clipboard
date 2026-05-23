import { ImageQuality, Message, Response } from "../shared/types";
import { base64ToBytes } from "../shared/base64";

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
  const r = (await chrome.runtime.sendMessage(msg)) as Response;
  if (!r) throw new Error("service worker returned no response");
  return r;
}

// Re-encode to PNG so the ClipboardItem key ("image/png") always matches the
// blob type. The bitmap is decoded from local bytes (not an on-page cross-origin
// <img>), so the canvas is not tainted and toBlob succeeds.
async function transcodeToPng(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("could not get a 2d canvas context");
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
        "image/png"
      )
    );
  } finally {
    bitmap.close();
  }
}

async function buildPngBlob(args: CopyArgs): Promise<Blob> {
  const r = await send({ type: "COPY_IMAGE", ...args });
  if (!r.ok) {
    throw Object.assign(new Error(r.message), {
      fallbackUrl: r.fallbackUrl ?? args.candidateUrl,
    });
  }
  if (r.type !== "IMAGE") {
    throw Object.assign(new Error("unexpected response"), {
      fallbackUrl: args.candidateUrl,
    });
  }
  const sourceBlob = new Blob([base64ToBytes(r.base64) as BlobPart], {
    type: r.mimeType,
  });
  if (r.mimeType === "image/png") return sourceBlob;
  try {
    return await transcodeToPng(sourceBlob);
  } catch (e) {
    throw Object.assign(new Error(`transcode failed: ${(e as Error).message}`), {
      fallbackUrl: args.candidateUrl,
    });
  }
}

export async function copyImage(args: CopyArgs): Promise<CopyResult> {
  // Construct the ClipboardItem synchronously inside the click gesture; the
  // network fetch and transcode happen inside the Promise<Blob>.
  const blobPromise = buildPngBlob(args);
  blobPromise.catch(() => {}); // avoid an unhandled-rejection warning
  try {
    const item = new ClipboardItem({ "image/png": blobPromise });
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch (e) {
    // If buildPngBlob was the failure, recover its real reason + fallback URL.
    let err = e as Error & { fallbackUrl?: string };
    try {
      await blobPromise;
    } catch (inner) {
      err = inner as Error & { fallbackUrl?: string };
    }
    const fallbackUrl = err.fallbackUrl ?? args.candidateUrl;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
      return { ok: true, fellBackToUrl: true, errorMessage: err.message };
    } catch {
      return { ok: false, errorMessage: err.message };
    }
  }
}

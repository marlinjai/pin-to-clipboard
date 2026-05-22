import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyImage } from "../../src/content/clipboard";
import { bytesToBase64 } from "../../src/shared/base64";

function mockMessage(reply: unknown) {
  (globalThis as any).chrome = {
    runtime: { sendMessage: vi.fn(async () => reply) },
  };
}

function mockClipboard() {
  (globalThis as any).ClipboardItem = class {
    data: Record<string, unknown>;
    constructor(data: Record<string, unknown>) {
      this.data = data;
    }
  };
  const writes: unknown[][] = [];
  const writeText = vi.fn(async () => {});
  // Faithfully simulate Chrome awaiting the Promise<Blob> inside ClipboardItem.
  const write = vi.fn(async (items: { data: Record<string, unknown> }[]) => {
    for (const it of items) {
      for (const v of Object.values(it.data)) {
        if (v && typeof (v as Promise<unknown>).then === "function") await v;
      }
    }
    writes.push(items);
  });
  (globalThis as any).navigator = { clipboard: { write, writeText } };
  return { writes, writeText, write };
}

const realCreateElement = document.createElement.bind(document);

describe("copyImage", () => {
  beforeEach(() => {
    document.hasFocus = () => true;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a PNG blob directly when the source is already PNG", async () => {
    const base64 = bytesToBase64(new Uint8Array([1, 2, 3]).buffer);
    mockMessage({ ok: true, type: "IMAGE", base64, mimeType: "image/png", resolvedUrl: "u" });
    const { writes } = mockClipboard();
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(r.fellBackToUrl).toBeFalsy();
    expect(writes.length).toBe(1);
  });

  it("transcodes a non-PNG source to PNG before writing", async () => {
    const base64 = bytesToBase64(new Uint8Array([255, 216, 255, 217]).buffer);
    mockMessage({ ok: true, type: "IMAGE", base64, mimeType: "image/jpeg", resolvedUrl: "u" });
    const pngBlob = new Blob([new Uint8Array([9])], { type: "image/png" });
    (globalThis as any).createImageBitmap = vi.fn(async () => ({
      width: 2,
      height: 2,
      close: vi.fn(),
    }));
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: (b: Blob) => void) => cb(pngBlob),
        } as unknown as HTMLCanvasElement;
      }
      return realCreateElement(tag);
    });
    const { writes } = mockClipboard();
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(r.fellBackToUrl).toBeFalsy();
    expect(globalThis.createImageBitmap).toHaveBeenCalled();
    expect(writes.length).toBe(1);
  });

  it("falls back to copying the URL when the image cannot be copied", async () => {
    mockMessage({
      ok: false,
      code: "ANIMATED_UNCOPYABLE",
      message: "Animated image, copy URL instead",
      fallbackUrl: "https://i.pinimg.com/originals/a.gif",
    });
    const { writeText } = mockClipboard();
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(r.fellBackToUrl).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://i.pinimg.com/originals/a.gif");
  });
});

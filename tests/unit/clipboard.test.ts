import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyImage } from "../../src/content/clipboard";

function mockClipboardSupports(supported: string[]) {
  (globalThis as any).ClipboardItem = class {
    constructor(public data: Record<string, Blob | Promise<Blob>>) {}
    static supports(mime: string) { return supported.includes(mime); }
  };
  const writes: unknown[][] = [];
  (globalThis as any).navigator = {
    clipboard: {
      write: vi.fn(async (items: { data: Record<string, unknown> }[]) => {
        for (const it of items) {
          for (const v of Object.values(it.data)) {
            if (v && typeof (v as Promise<unknown>).then === "function") {
              await v;
            }
          }
        }
        writes.push(items);
      }),
    },
  };
  return writes;
}

function mockMessage(reply: any) {
  (globalThis as any).chrome = {
    runtime: { sendMessage: vi.fn(async () => reply) },
  };
}

describe("copyImage", () => {
  beforeEach(() => { document.hasFocus = () => true; });

  it("writes directly when the source is already PNG", async () => {
    const bytes = new Uint8Array([1,2,3]).buffer;
    mockMessage({ ok: true, type: "MEDIA", bytes, mimeType: "image/png", resolvedUrl: "u" });
    const writes = mockClipboardSupports(["image/png"]);
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(writes.length).toBe(1);
  });

  it("transcodes via offscreen when mime unsupported", async () => {
    const bytes = new Uint8Array([1]).buffer;
    const png = new Uint8Array([9]).buffer;
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, type: "MEDIA", bytes, mimeType: "image/webp", resolvedUrl: "u" })
      .mockResolvedValueOnce({ ok: true, type: "PNG_BYTES", bytes: png });
    (globalThis as any).chrome = { runtime: { sendMessage: send } };
    const writes = mockClipboardSupports(["image/png"]);
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(writes.length).toBe(1);
  });

  it("falls back to URL text on animated", async () => {
    mockMessage({ ok: false, code: "ANIMATED_UNCOPYABLE", message: "x", fallbackUrl: "https://i.pinimg.com/originals/a.gif" });
    (globalThis as any).ClipboardItem = class {
      constructor(public data: Record<string, Blob | Promise<Blob>>) {}
    };
    const writeText = vi.fn();
    const write = vi.fn(async (items: { data: Record<string, unknown> }[]) => {
      for (const it of items) {
        for (const v of Object.values(it.data)) {
          if (v && typeof (v as Promise<unknown>).then === "function") {
            await v;
          }
        }
      }
    });
    (globalThis as any).navigator = { clipboard: { writeText, write } };
    const r = await copyImage({ pinId: "p", candidateUrl: "u", quality: "largest-available" });
    expect(r.ok).toBe(true);
    expect(r.fellBackToUrl).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://i.pinimg.com/originals/a.gif");
  });
});

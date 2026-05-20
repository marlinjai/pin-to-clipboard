chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "OFFSCREEN_TRANSCODE") return;
  (async () => {
    try {
      const blob = new Blob([msg.bytes], { type: msg.mimeType });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const png = await canvas.convertToBlob({ type: "image/png" });
      const bytes = await png.arrayBuffer();
      sendResponse({ ok: true, bytes });
    } catch (e) {
      sendResponse({ ok: false, message: String((e as Error).message) });
    }
  })();
  return true;
});

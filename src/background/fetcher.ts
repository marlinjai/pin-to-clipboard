export async function fetchBytes(url: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const bytes = await res.arrayBuffer();
  return { bytes, mimeType };
}

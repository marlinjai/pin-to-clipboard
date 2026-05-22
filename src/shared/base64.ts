// Chrome extension messaging (chrome.runtime.sendMessage) serializes messages
// with a JSON-style serializer that does NOT preserve ArrayBuffer, Blob, or
// typed arrays - they arrive as empty objects. Any binary payload that crosses
// a message boundary must be encoded as a string first.

const CHUNK = 0x8000;

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

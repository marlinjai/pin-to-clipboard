import { describe, it, expect } from "vitest";
import { bytesToBase64, base64ToBytes } from "../../src/shared/base64";

describe("base64", () => {
  it("round-trips arbitrary bytes exactly", () => {
    const original = new Uint8Array([0, 1, 2, 77, 13, 10, 128, 254, 255]);
    const back = base64ToBytes(bytesToBase64(original.buffer));
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it("round-trips a large buffer without overflowing the call stack", () => {
    const big = new Uint8Array(200_000);
    for (let i = 0; i < big.length; i++) big[i] = i % 256;
    const back = base64ToBytes(bytesToBase64(big.buffer));
    expect(back.length).toBe(big.length);
    expect(back[0]).toBe(0);
    expect(back[199_999]).toBe(199_999 % 256);
  });

  it("produces a string decodable by atob", () => {
    const b64 = bytesToBase64(new Uint8Array([1, 2, 3]).buffer);
    expect(() => atob(b64)).not.toThrow();
  });

  it("round-trips an empty buffer", () => {
    expect(base64ToBytes(bytesToBase64(new ArrayBuffer(0))).length).toBe(0);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveBestUrl, __resetCache } from "../../src/background/resolver";

type Probe = Record<string, number>; // url -> status

function mockFetch(map: Probe) {
  globalThis.fetch = vi.fn(async (url) => {
    const status = map[String(url)] ?? 404;
    return new Response(null, { status });
  }) as unknown as typeof fetch;
}

beforeEach(() => __resetCache());

describe("resolveBestUrl", () => {
  it("returns the displayed url as floor when no larger size is reachable", async () => {
    mockFetch({ "https://i.pinimg.com/236x/aa/bb/cc/x.jpg": 200 });
    const r = await resolveBestUrl(
      "pin1",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "largest-available"
    );
    expect(r.url).toBe("https://i.pinimg.com/236x/aa/bb/cc/x.jpg");
  });

  it("walks the ladder and picks the largest that responds 200", async () => {
    mockFetch({
      "https://i.pinimg.com/736x/aa/bb/cc/x.jpg": 200,
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg": 200,
    });
    const r = await resolveBestUrl(
      "pin2",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "largest-available"
    );
    expect(r.url).toBe("https://i.pinimg.com/736x/aa/bb/cc/x.jpg");
  });

  it("tries extension permutations on /originals/", async () => {
    mockFetch({
      "https://i.pinimg.com/originals/aa/bb/cc/x.png": 200,
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg": 200,
    });
    const r = await resolveBestUrl(
      "pin3",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "original"
    );
    expect(r.url).toBe("https://i.pinimg.com/originals/aa/bb/cc/x.png");
  });

  it("caches resolved URL", async () => {
    const map = { "https://i.pinimg.com/736x/aa/bb/cc/x.jpg": 200 };
    mockFetch(map);
    await resolveBestUrl("pin4", "https://i.pinimg.com/236x/aa/bb/cc/x.jpg", "largest-available");
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await resolveBestUrl("pin4", "https://i.pinimg.com/236x/aa/bb/cc/x.jpg", "largest-available");
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
  });

  it("backs off on 429", async () => {
    mockFetch({}); // all 404
    (globalThis.fetch as unknown as { mockImplementationOnce: Function }).mockImplementationOnce(
      async () => new Response(null, { status: 429 })
    );
    const r = await resolveBestUrl(
      "pin5",
      "https://i.pinimg.com/236x/aa/bb/cc/x.jpg",
      "largest-available"
    );
    expect(r.url).toBe("https://i.pinimg.com/236x/aa/bb/cc/x.jpg");
    expect(r.backoff).toBe(true);
  });
});

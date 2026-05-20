import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, setSettings } from "../../src/options/storage";
import { DEFAULT_SETTINGS } from "../../src/shared/types";

function mockChromeStorage(initial: Record<string, unknown> = {}) {
  const store = { ...initial };
  // @ts-expect-error - test stub
  globalThis.chrome = {
    storage: {
      sync: {
        get: vi.fn(async (keys) => {
          const k = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(k.map((x) => [x, store[x as string]]));
        }),
        set: vi.fn(async (obj) => Object.assign(store, obj)),
      },
    },
  };
  return store;
}

describe("storage", () => {
  beforeEach(() => mockChromeStorage());

  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips values and ignores unknown enum strings", async () => {
    await setSettings({ imageQuality: "original" });
    expect((await getSettings()).imageQuality).toBe("original");
  });

  it("falls back to default for an invalid stored value", async () => {
    mockChromeStorage({ settings: { imageQuality: "bogus", videoAction: "copy-url" } });
    expect((await getSettings()).imageQuality).toBe(DEFAULT_SETTINGS.imageQuality);
  });

  it("merges patches so unrelated fields are preserved", async () => {
    await setSettings({ imageQuality: "original" });
    await setSettings({ videoAction: "download" });
    const s = await getSettings();
    expect(s.imageQuality).toBe("original");
    expect(s.videoAction).toBe("download");
  });
});

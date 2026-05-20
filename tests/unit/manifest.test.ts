import { describe, it, expect } from "vitest";
import manifest from "../../src/manifest.json" assert { type: "json" };

describe("manifest", () => {
  it("declares MV3 with the expected permissions and no clipboardWrite", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "downloads", "offscreen"])
    );
    expect(manifest.permissions).not.toContain("clipboardWrite");
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        "*://*.pinterest.com/*",
        "*://i.pinimg.com/*",
        "*://v.pinimg.com/*",
      ])
    );
  });

  it("registers SW, content script, options page, and action", () => {
    expect(manifest.background!.service_worker).toBe("background/index.js");
    expect(manifest.content_scripts![0]!.matches).toContain("*://*.pinterest.com/*");
    expect(manifest.content_scripts![0]!.js).toEqual(["content/index.js"]);
    expect(manifest.options_page).toBe("options/options.html");
    expect(manifest.action).toBeDefined();
  });
});

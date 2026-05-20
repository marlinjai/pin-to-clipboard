import { describe, it, expect, vi } from "vitest";
import { showToast } from "../../src/content/toast";

describe("toast", () => {
  it("renders a transient message that auto-dismisses", async () => {
    vi.useFakeTimers();
    showToast("Copied", "ok", 1000);
    expect(document.querySelector('[data-ptc-toast]')!.textContent).toContain("Copied");
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('[data-ptc-toast]')).toBeNull();
    vi.useRealTimers();
  });
});

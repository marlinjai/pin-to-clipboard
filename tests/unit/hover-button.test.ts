import { describe, it, expect, vi } from "vitest";
import { attachHoverButton } from "../../src/content/hover-button";

function makeCard(id = "p1") {
  const el = document.createElement("div");
  el.dataset.testId = "pin";
  el.dataset.pinId = id;
  el.innerHTML = `<img src="https://i.pinimg.com/236x/x/y/z/a.jpg">`;
  document.body.appendChild(el);
  return el;
}

describe("hover-button", () => {
  it("injects an accessible button once and is idempotent", () => {
    const card = makeCard();
    attachHoverButton(card, vi.fn());
    attachHoverButton(card, vi.fn());
    const btns = card.querySelectorAll('button[data-ptc="copy"]');
    expect(btns.length).toBe(1);
    const btn = btns[0]!;
    expect(btn.getAttribute("aria-label")).toMatch(/copy/i);
  });

  it("invokes the click handler with the card", () => {
    const card = makeCard();
    const onClick = vi.fn();
    attachHoverButton(card, onClick);
    (card.querySelector('button[data-ptc="copy"]') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledWith(card);
  });

  it("exposes setState for idle/loading/ok/error", () => {
    const card = makeCard();
    const api = attachHoverButton(card, vi.fn());
    api.setState("loading");
    expect((card.querySelector('button[data-ptc="copy"]') as HTMLElement).dataset.state).toBe("loading");
    api.setState("ok");
    expect((card.querySelector('button[data-ptc="copy"]') as HTMLElement).dataset.state).toBe("ok");
  });
});

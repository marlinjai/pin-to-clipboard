import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  findPinCards,
  classifyCard,
  extractCandidateImageUrl,
  extractVideoSources,
} from "../../src/content/pin-detection";

function loadDom(path: string) {
  document.body.innerHTML = readFileSync(path, "utf8");
}

describe("pin-detection", () => {
  it("finds pin cards on a board page", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(cards.map((c) => c.dataset.pinId)).toEqual(["111", "222", "333"]);
  });

  it("classifies image vs video", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(classifyCard(cards[0]!)).toBe("image");
    expect(classifyCard(cards[1]!)).toBe("video");
  });

  it("extracts the displayed image URL, preferring the largest srcset entry", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(extractCandidateImageUrl(cards[0]!)).toBe(
      "https://i.pinimg.com/474x/aa/bb/cc/x.jpg"
    );
  });

  it("returns null when src is a placeholder (data: or <100px)", () => {
    loadDom("tests/fixtures/board.html");
    const cards = findPinCards(document);
    expect(extractCandidateImageUrl(cards[2]!)).toBeNull();
  });

  it("extracts mp4 + hls + poster on a detail video page", () => {
    loadDom("tests/fixtures/detail-video.html");
    const card = document.querySelector<HTMLElement>("[data-test-id=pin-closeup]")!;
    const s = extractVideoSources(card);
    expect(s.mp4Url).toMatch(/\.mp4$/);
    expect(s.hlsUrl).toMatch(/\.m3u8$/);
    expect(s.posterUrl).toMatch(/i\.pinimg\.com/);
  });
});

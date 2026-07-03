import { describe, it, expect } from "vitest";
import { chunkText } from "./chunkText.js";

describe("chunkText", () => {
  it("groups sentences into overlapping windows", () => {
    const text = "One. Two. Three. Four. Five.";
    const chunks = chunkText(text, 3, 1);

    expect(chunks[0]).toBe("One.  Two.  Three.");
    // step = sentencesPerChunk - overlapSentences = 2, so the next window starts at sentence 3
    expect(chunks[1]).toBe("Three.  Four.  Five.");
  });

  it("collapses extra whitespace before splitting", () => {
    const text = "  One.\n\nTwo.   Three.  ";
    const chunks = chunkText(text, 3, 0);

    expect(chunks).toEqual(["One.  Two.  Three."]);
  });

  it("falls back to the whole text when there is no sentence punctuation", () => {
    const chunks = chunkText("no punctuation here");
    expect(chunks).toEqual(["no punctuation here"]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});

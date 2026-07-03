import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "./retrieval.js";

describe("reciprocalRankFusion", () => {
  it("ranks a document found by both searches above one found by only one", () => {
    const vectorResults = [{ id: 1 }, { id: 2 }];
    const keywordResults = [{ id: 2 }, { id: 3 }];

    const fused = reciprocalRankFusion(vectorResults, keywordResults);

    expect(fused[0].id).toBe(2); // appears in both lists, highest combined score
    expect(fused.map((r) => r.id).sort()).toEqual([1, 2, 3]);
  });

  it("preserves rank order when there is no overlap", () => {
    const vectorResults = [{ id: "a" }, { id: "b" }];
    const keywordResults = [];

    const fused = reciprocalRankFusion(vectorResults, keywordResults);

    expect(fused.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("returns an empty list when both inputs are empty", () => {
    expect(reciprocalRankFusion([], [])).toEqual([]);
  });
});

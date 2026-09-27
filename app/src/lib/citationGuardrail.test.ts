import { describe, it, expect } from "vitest";
import { findDois, looksLikeReferenceList, prepareAssistantTextForPaper } from "./citationGuardrail";

describe("findDois", () => {
  it("finds unique DOIs and trims trailing punctuation", () => {
    expect(findDois("See 10.1109/5.771073. Also https://doi.org/10.1145/3292500.3330701, and 10.1109/5.771073")).toEqual([
      "10.1109/5.771073",
      "10.1145/3292500.3330701",
    ]);
  });
});

describe("looksLikeReferenceList", () => {
  it("spots numbered bibliographic entries", () => {
    const text = `Here are sources:\n[1] A. Smith et al., "Deep nets," IEEE Trans. Neural Netw., 2019.\n[2] B. Jones, "Edge AI," Proc. ICC, 2021.`;
    expect(looksLikeReferenceList(text)).toBe(true);
  });
  it("ignores ordinary numbered steps", () => {
    expect(looksLikeReferenceList("1. Collect data\n2. Train the model in 2024")).toBe(false);
  });
});

describe("prepareAssistantTextForPaper", () => {
  it("strips markdown, drops the reference list and typed citations", () => {
    const md = [
      "## Introduction",
      "Edge computing **reduces latency** [1], [3].",
      "",
      "- First point",
      "- Second point",
      "",
      "### References",
      "[1] A. Smith, 2019.",
      "[3] B. Jones, 2020.",
    ].join("\n");
    expect(prepareAssistantTextForPaper(md)).toEqual({
      paragraphs: ["Edge computing reduces latency.", "First point", "Second point"],
      removedCitations: 1,
      droppedReferenceLines: 2,
    });
  });

  it("skips code blocks", () => {
    expect(prepareAssistantTextForPaper("Text.\n```\ncode\n```\nMore.").paragraphs).toEqual(["Text.", "More."]);
  });
});
